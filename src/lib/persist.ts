// Crash-safe persistence for in-flight withdrawals. A withdrawal spans a Gonka
// burn, a BLS poll, and an EVM tx — if the tab closes mid-flight the user must
// be able to resume without re-burning. Keyed per Gonka address.

export type WithdrawStep = "polling" | "ready" | "withdrawing" | "done";

export interface PendingWithdraw {
  tokenSymbol: string;
  /** Token identity captured at burn time — release() MUST use these, not the
   *  currently-selected token, or it could call the wrong contract method. */
  tokenKind: "cw20" | "native";
  tokenErc20: string;
  tokenDecimals: number;
  amount: string; // base units
  destinationEth: string;
  gonkaTxHash: string;
  requestIdHex: string;
  epochId: number | null;
  signatureHex: string | null;
  ethereumTxHash: string | null;
  step: WithdrawStep;
  updatedAt: number;
}

const keyFor = (gonkaAddress: string) => `pending_unwrap_${gonkaAddress}`;

// Runtime validation — localStorage is untrusted (corruption, tampering, version
// drift). A bad destinationEth/requestIdHex would otherwise flow into a real EVM
// release. Reject anything that doesn't match the exact shape.
function isValidPending(v: unknown): v is PendingWithdraw {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  const isHex = (s: unknown, len: number) =>
    typeof s === "string" && s.startsWith("0x") && s.length === len && /^0x[0-9a-fA-F]+$/.test(s);
  return (
    typeof p.tokenSymbol === "string" &&
    (p.tokenKind === "cw20" || p.tokenKind === "native") &&
    typeof p.tokenErc20 === "string" &&
    typeof p.tokenDecimals === "number" &&
    typeof p.amount === "string" &&
    /^\d+$/.test(p.amount) &&
    isHex(p.destinationEth, 42) &&
    isHex(p.requestIdHex, 66) &&
    (p.epochId === null || typeof p.epochId === "number") &&
    (p.signatureHex === null || isHex(p.signatureHex, 258)) &&
    (p.ethereumTxHash === null || typeof p.ethereumTxHash === "string") &&
    (p.step === "polling" || p.step === "ready" || p.step === "withdrawing" || p.step === "done")
  );
}

export function loadPending(gonkaAddress: string): PendingWithdraw | null {
  try {
    const raw = localStorage.getItem(keyFor(gonkaAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidPending(parsed)) {
      clearPending(gonkaAddress); // drop corrupt/legacy records rather than act on them
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePending(gonkaAddress: string, value: PendingWithdraw): void {
  try {
    localStorage.setItem(keyFor(gonkaAddress), JSON.stringify(value));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function clearPending(gonkaAddress: string): void {
  try {
    localStorage.removeItem(keyFor(gonkaAddress));
  } catch {
    /* ignore */
  }
}
