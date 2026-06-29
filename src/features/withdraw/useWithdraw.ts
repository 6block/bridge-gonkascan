import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { EVM, type BridgeToken } from "@/config/chains";
import { executeBurnWithdraw, executeNativeBridgeMint } from "@/lib/burn";
import {
  getBlsEpoch,
  getBlsSignature,
  normalizeStatus,
  ThresholdStatus,
} from "@/lib/gonka";
import { groupKeyToHex, thresholdSignatureToHex, validationSignatureToHex } from "@/lib/bls";
import {
  AlreadyProcessedError,
  getReadProvider,
  readBridgeState,
  submitGroupKey,
  submitMint,
  submitWithdraw,
} from "@/lib/evm";
import { toBareHex } from "@/lib/requestId";
import {
  clearPending,
  loadPending,
  savePending,
  type PendingWithdraw,
} from "@/lib/persist";

export type WithdrawStatus =
  | "idle"
  | "burning"
  | "polling"
  | "catchup"
  | "withdrawing"
  | "success"
  | "error";

interface State {
  status: WithdrawStatus;
  pending: PendingWithdraw | null;
  ethereumTxHash: string | null;
  note: string | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_ATTEMPTS = 150; // ~10 minutes
const CATCHUP_CAP = 40; // refuse to self-submit more than this many epochs

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turn cryptic cosmjs signing errors into actionable guidance. */
function humanizeBurnError(err: unknown, gonkaAddress: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/does not exist on chain|account .*not found/i.test(msg)) {
    return (
      `Your Gonka account isn't active yet. Wrapped (CW20) tokens don't activate an account or ` +
      `pay gas — send a little native GNK to ${gonkaAddress}, then retry the withdrawal.`
    );
  }
  if (/insufficient funds|insufficient fee/i.test(msg)) {
    return `Not enough native GNK for gas. Send a little GNK to ${gonkaAddress} and retry.`;
  }
  return msg;
}

export function useWithdraw(
  token: BridgeToken,
  provider: BrowserProvider | null,
  gonkaAddress: string | null,
  evmRecipient: string | null,
  guardOk: boolean,
) {
  const [state, setState] = useState<State>({
    status: "idle",
    pending: gonkaAddress ? loadPending(gonkaAddress) : null,
    ethereumTxHash: null,
    note: null,
    error: null,
  });
  const cancelled = useRef(false);

  // Refresh any persisted in-flight withdrawal when the account changes.
  useEffect(() => {
    setState((s) => ({ ...s, pending: gonkaAddress ? loadPending(gonkaAddress) : null }));
  }, [gonkaAddress]);

  const persist = useCallback(
    (p: PendingWithdraw) => {
      if (gonkaAddress) savePending(gonkaAddress, p);
      setState((s) => ({ ...s, pending: p }));
    },
    [gonkaAddress],
  );

  // ---- stage 2: poll BLS until the threshold signature completes ----------
  const pollSignature = useCallback(
    async (p: PendingWithdraw): Promise<PendingWithdraw> => {
      setState((s) => ({ ...s, status: "polling", note: "Waiting for validator signatures…" }));
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        if (cancelled.current) throw new Error("cancelled");
        const res = await getBlsSignature(toBareHex(p.requestIdHex)).catch(() => null);
        const status = normalizeStatus(res?.signing_request?.status);
        if (status === ThresholdStatus.FAILED) {
          throw new Error("Validators failed to produce a signature (status FAILED).");
        }
        if (status === ThresholdStatus.COMPLETED && res?.uncompressed_signature_128) {
          const epochId = Number(res.signing_request?.current_epoch_id);
          return {
            ...p,
            epochId,
            signatureHex: thresholdSignatureToHex(res.uncompressed_signature_128),
            step: "ready",
          };
        }
        await sleep(POLL_INTERVAL_MS);
      }
      throw new Error("Timed out waiting for the BLS signature. Resume later to retry.");
    },
    [],
  );

  // ---- defensive epoch catch-up (normally a no-op; automation keeps sync) --
  const ensureEpoch = useCallback(
    async (epochId: number) => {
      if (!provider) throw new Error("Connect MetaMask");
      const { latestEpochId } = await readBridgeState(getReadProvider());
      let latest = Number(latestEpochId);
      if (latest >= epochId) return;
      const gap = epochId - latest;
      if (gap > CATCHUP_CAP) {
        throw new Error(
          `Bridge is ${gap} epochs behind (at ${latest}, need ${epochId}). ` +
            "Wait for the auto-sync to catch up, then resume.",
        );
      }
      setState((s) => ({ ...s, status: "catchup", note: `Syncing ${gap} epoch(s) to the bridge…` }));
      for (let e = latest + 1; e <= epochId; e++) {
        if (cancelled.current) throw new Error("cancelled");
        const data = await getBlsEpoch(e);
        if (!data.group_public_key_uncompressed_256 || !data.validation_signature_uncompressed_128) {
          throw new Error(`Epoch ${e} has no finalized group key yet — try again shortly.`);
        }
        await submitGroupKey(
          provider,
          e,
          groupKeyToHex(data.group_public_key_uncompressed_256),
          validationSignatureToHex(data.validation_signature_uncompressed_128),
        );
        latest = e;
      }
    },
    [provider],
  );

  // ---- stage 3: release on Sepolia ----------------------------------------
  const release = useCallback(
    async (p: PendingWithdraw) => {
      if (!provider) throw new Error("Connect MetaMask");
      if (p.epochId === null || !p.signatureHex) throw new Error("Missing signature/epoch");
      await ensureEpoch(p.epochId);
      setState((s) => ({ ...s, status: "withdrawing", note: `Releasing tokens on ${EVM.name}…` }));
      // Use the token identity captured in the pending record, NOT the currently
      // selected token — on resume they can differ, which would call the wrong
      // contract method and strand the funds.
      let ethereumTxHash: string;
      try {
        ethereumTxHash =
          p.tokenKind === "native"
            ? await submitMint(provider, {
                epochId: p.epochId,
                requestId: p.requestIdHex,
                recipient: p.destinationEth,
                amount: BigInt(p.amount),
                signature: p.signatureHex,
              })
            : await submitWithdraw(provider, {
                epochId: p.epochId,
                requestId: p.requestIdHex,
                recipient: p.destinationEth,
                tokenContract: p.tokenErc20,
                amount: BigInt(p.amount),
                signature: p.signatureHex,
              });
      } catch (err) {
        // RequestAlreadyProcessed = this withdrawal already settled on-chain
        // (e.g. a prior retry landed). Treat as success — funds are released.
        if (err instanceof AlreadyProcessedError) {
          const settled: PendingWithdraw = { ...p, step: "done" };
          if (gonkaAddress) clearPending(gonkaAddress);
          setState({
            status: "success",
            pending: settled,
            ethereumTxHash: null,
            note: "Already released on-chain — your tokens are in your wallet.",
            error: null,
          });
          return;
        }
        throw err;
      }
      const done: PendingWithdraw = { ...p, ethereumTxHash, step: "done" };
      if (gonkaAddress) clearPending(gonkaAddress);
      setState({ status: "success", pending: done, ethereumTxHash, note: null, error: null });
    },
    [provider, gonkaAddress, ensureEpoch],
  );

  const runFrom = useCallback(
    async (p: PendingWithdraw) => {
      try {
        let next = p;
        if (next.step === "polling") {
          next = await pollSignature(next);
          persist(next);
        }
        await release(next);
      } catch (err) {
        if (err instanceof Error && err.message === "cancelled") return;
        setState((s) => ({
          ...s,
          status: "error",
          error: err instanceof Error ? err.message : "Withdrawal failed",
        }));
      }
    },
    [pollSignature, release, persist],
  );

  const withdraw = useCallback(
    async (amountBase: bigint) => {
      if (!gonkaAddress) return setError("Connect Keplr first");
      if (!evmRecipient) return setError("Connect MetaMask first");
      if (!guardOk) return setError("Address mismatch — bridging is blocked");
      if (amountBase <= 0n) return setError("Enter an amount");
      cancelled.current = false;
      setState((s) => ({ ...s, status: "burning", error: null, note: "Confirm the burn in Keplr…" }));
      try {
        const { txHash, requestIdHex } =
          token.kind === "native"
            ? await executeNativeBridgeMint({
                sender: gonkaAddress,
                amount: amountBase,
                ethRecipient: evmRecipient,
                bridgeAddress: EVM.bridgeAddress,
                chainId: EVM.registryKey,
              })
            : await executeBurnWithdraw({
                cw20: token.cw20,
                sender: gonkaAddress,
                amount: amountBase,
                ethRecipient: evmRecipient,
                bridgeAddress: EVM.bridgeAddress,
              });
        const p: PendingWithdraw = {
          tokenSymbol: token.symbol,
          tokenKind: token.kind,
          tokenErc20: token.erc20,
          tokenDecimals: token.decimals,
          amount: amountBase.toString(),
          destinationEth: evmRecipient,
          gonkaTxHash: txHash,
          requestIdHex,
          epochId: null,
          signatureHex: null,
          ethereumTxHash: null,
          step: "polling",
          updatedAt: Date.now(),
        };
        persist(p);
        await runFrom(p);
      } catch (err) {
        setState((s) => ({ ...s, status: "error", error: humanizeBurnError(err, gonkaAddress) }));
      }
    },
    [gonkaAddress, evmRecipient, guardOk, token, persist, runFrom],
  );

  const resume = useCallback(() => {
    if (state.pending && state.pending.step !== "done") {
      cancelled.current = false;
      void runFrom(state.pending);
    }
  }, [state.pending, runFrom]);

  const dismiss = useCallback(() => {
    cancelled.current = true;
    if (gonkaAddress) clearPending(gonkaAddress);
    setState({ status: "idle", pending: null, ethereumTxHash: null, note: null, error: null });
  }, [gonkaAddress]);

  function setError(msg: string) {
    setState((s) => ({ ...s, status: "error", error: msg }));
  }

  return { ...state, withdraw, resume, dismiss };
}
