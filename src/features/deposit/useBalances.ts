import { useCallback, useEffect, useState } from "react";
import { getErc20Contract, getReadProvider } from "@/lib/evm";
import { getCw20Balance, getNativeGnkBalance } from "@/lib/gonka";
import type { BridgeToken } from "@/config/chains";

export interface TokenBalances {
  /** Ethereum-side balance (Sepolia ERC-20 / WGNK), base units, null until loaded. */
  evm: bigint | null;
  /** Gonka-side balance (CW20 wrapped, or native GNK), base units, null until loaded. */
  gonka: bigint | null;
}

/**
 * Live balances for one token across both chains. `evmAddress` is the MetaMask
 * account; `gonkaAddress` is the connected Keplr account.
 */
export function useBalances(
  token: BridgeToken,
  evmAddress: string | null,
  gonkaAddress: string | null,
): TokenBalances & { refresh: () => void } {
  const [balances, setBalances] = useState<TokenBalances>({ evm: null, gonka: null });

  const load = useCallback(async () => {
    const next: TokenBalances = { evm: null, gonka: null };
    await Promise.all([
      (async () => {
        if (!evmAddress) return;
        try {
          const c = getErc20Contract(token.erc20, getReadProvider());
          next.evm = (await c.balanceOf(evmAddress)) as bigint;
        } catch {
          next.evm = null;
        }
      })(),
      (async () => {
        if (!gonkaAddress) return;
        try {
          next.gonka =
            token.kind === "native"
              ? await getNativeGnkBalance(gonkaAddress)
              : BigInt(await getCw20Balance(token.cw20, gonkaAddress));
        } catch {
          next.gonka = null;
        }
      })(),
    ]);
    setBalances(next);
  }, [token, evmAddress, gonkaAddress]);

  useEffect(() => {
    // Clear stale balances first: keeping the previous token's raw value would
    // briefly render it with the new token's decimals (e.g. GNK 0.7 shown as
    // "700" before USDT's real balance lands). Show "—" until the load resolves.
    setBalances({ evm: null, gonka: null });
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  return { ...balances, refresh: () => void load() };
}
