import { useCallback, useEffect, useState } from "react";
import { getErc20Contract, getReadProvider } from "@/lib/evm";
import { getCw20Balance } from "@/lib/gonka";
import type { BridgeToken } from "@/config/chains";

export interface TokenBalances {
  /** Sepolia ERC-20 balance (base units), null until loaded. */
  erc20: bigint | null;
  /** Gonka CW20 wrapped balance (base units), null until loaded. */
  cw20: bigint | null;
}

/**
 * Live balances for one token across both chains. `evmAddress` is the MetaMask
 * account; `gonkaAddress` is the connected Keplr account (the deposit credit
 * target — see Phase 2 derivation note).
 */
export function useBalances(
  token: BridgeToken,
  evmAddress: string | null,
  gonkaAddress: string | null,
): TokenBalances & { refresh: () => void } {
  const [balances, setBalances] = useState<TokenBalances>({ erc20: null, cw20: null });

  const load = useCallback(async () => {
    const next: TokenBalances = { erc20: null, cw20: null };
    await Promise.all([
      (async () => {
        if (!evmAddress) return;
        try {
          const c = getErc20Contract(token.erc20, getReadProvider());
          next.erc20 = (await c.balanceOf(evmAddress)) as bigint;
        } catch {
          next.erc20 = null;
        }
      })(),
      (async () => {
        if (!gonkaAddress) return;
        try {
          next.cw20 = BigInt(await getCw20Balance(token.cw20, gonkaAddress));
        } catch {
          next.cw20 = null;
        }
      })(),
    ]);
    setBalances(next);
  }, [token, evmAddress, gonkaAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...balances, refresh: () => void load() };
}
