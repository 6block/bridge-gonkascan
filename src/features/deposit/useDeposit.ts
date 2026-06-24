import { useCallback, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { SEPOLIA, type BridgeToken } from "@/config/chains";
import { ensureSepolia, getErc20Contract } from "@/lib/evm";
import { getCw20Balance } from "@/lib/gonka";

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

export function useDeposit(token: BridgeToken, provider: BrowserProvider | null, gonkaAddress: string | null) {
  const [state, setState] = useState<DepositState>(INITIAL);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    cancelled.current = true;
    setState(INITIAL);
  }, []);

  const deposit = useCallback(
    async (amountBase: bigint) => {
      if (!provider) return setState({ ...INITIAL, status: "error", error: "Connect MetaMask first" });
      if (!gonkaAddress) return setState({ ...INITIAL, status: "error", error: "Connect Keplr first" });
      if (amountBase <= 0n) return setState({ ...INITIAL, status: "error", error: "Enter an amount" });

      cancelled.current = false;
      setState({ status: "submitting", txHash: null, credited: null, error: null });

      try {
        await ensureSepolia(provider);

        // Baseline the Gonka wrapped balance so we can detect the credit.
        let baseline = 0n;
        try {
          baseline = BigInt(await getCw20Balance(token.cw20, gonkaAddress));
        } catch {
          baseline = 0n;
        }

        const signer = await provider.getSigner();
        const erc20 = getErc20Contract(token.erc20, signer);
        const tx = await erc20.transfer(SEPOLIA.bridgeAddress, amountBase);
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
            current = BigInt(await getCw20Balance(token.cw20, gonkaAddress));
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
            "Transfer confirmed on Sepolia. The Gonka credit is still settling — validators can " +
            "take a while to mint. It will arrive on its own; check your Gonka balance shortly.",
        }));
      } catch (err) {
        setState({
          status: "error",
          txHash: state.txHash,
          credited: null,
          error: err instanceof Error ? err.message : "Deposit failed",
        });
      }
    },
    // state.txHash intentionally read at call time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, gonkaAddress, token],
  );

  return { ...state, deposit, reset };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
