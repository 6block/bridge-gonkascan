import { useCallback, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { EVM, type BridgeToken } from "@/config/chains";
import { decodeBridgeError, ensureEvmNetwork, getErc20Contract } from "@/lib/evm";
import { getCw20Balance, getNativeGnkBalance } from "@/lib/gonka";

/** Gonka-side balance for credit detection — CW20 smart query or native bank. */
async function gonkaBalanceOf(token: BridgeToken, addr: string): Promise<bigint> {
  if (token.kind === "native") return getNativeGnkBalance(addr);
  return BigInt(await getCw20Balance(token.cw20, addr));
}

export type DepositStatus =
  | "idle"
  | "submitting" // waiting for wallet signature
  | "pending" // tx mining on Sepolia
  | "crediting" // polling Gonka for the wrapped credit
  | "success"
  | "slow" // transfer confirmed; credit not seen within the poll window (not an error)
  | "error";

interface DepositState {
  status: DepositStatus;
  txHash: string | null;
  credited: bigint | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 180; // ~15 minutes — validator observe + mint can lag well past 6

const INITIAL: DepositState = { status: "idle", txHash: null, credited: null, error: null };

export function useDeposit(
  token: BridgeToken,
  provider: BrowserProvider | null,
  gonkaAddress: string | null,
  guardOk: boolean,
) {
  const [state, setState] = useState<DepositState>(INITIAL);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    cancelled.current = true;
    setState(INITIAL);
  }, []);

  const deposit = useCallback(
    async (amountBase: bigint) => {
      const fail = (error: string) => setState({ ...INITIAL, status: "error", error });
      if (!provider) return fail("Connect MetaMask first");
      if (!gonkaAddress) return fail("Connect Keplr first");
      if (!/^gonka1[0-9a-z]{38,}$/.test(gonkaAddress)) return fail("Invalid Gonka recipient address");
      if (!guardOk) return fail("Address mismatch — bridging is blocked");
      if (amountBase <= 0n) return fail("Enter an amount");

      cancelled.current = false;
      setState({ status: "submitting", txHash: null, credited: null, error: null });

      try {
        await ensureEvmNetwork(provider);

        // Baseline the Gonka wrapped balance so we can detect the credit.
        let baseline = 0n;
        try {
          baseline = await gonkaBalanceOf(token, gonkaAddress);
        } catch {
          baseline = 0n;
        }

        const signer = await provider.getSigner();
        const erc20 = getErc20Contract(token.erc20, signer);
        const tx = await erc20.transfer(EVM.bridgeAddress, amountBase);
        setState((s) => ({ ...s, status: "pending", txHash: tx.hash }));

        await tx.wait();
        if (cancelled.current) return;
        setState((s) => ({ ...s, status: "crediting" }));

        // Poll until the wrapped balance rises above baseline.
        for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
          if (cancelled.current) return;
          await sleep(POLL_INTERVAL_MS);
          let current = baseline;
          try {
            current = await gonkaBalanceOf(token, gonkaAddress);
          } catch {
            continue;
          }
          if (current > baseline) {
            setState((s) => ({ ...s, status: "success", credited: current - baseline }));
            return;
          }
        }
        setState((s) => ({
          ...s,
          status: "slow",
          error:
            `Transfer confirmed on ${EVM.name}. The Gonka credit is still settling — validators ` +
            "can take a while to mint. It will arrive on its own; check your Gonka balance shortly.",
        }));
      } catch (err) {
        setState({
          status: "error",
          txHash: state.txHash,
          credited: null,
          error: decodeBridgeError(err),
        });
      }
    },
    // state.txHash intentionally read at call time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, gonkaAddress, guardOk, token],
  );

  return { ...state, deposit, reset };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
