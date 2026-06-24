// Crash-safe persistence for in-flight withdrawals. A withdrawal spans a Gonka
// burn, a BLS poll, and a Sepolia tx — if the tab closes mid-flight the user
// must be able to resume without re-burning. Keyed per Gonka address.

export type WithdrawStep = "polling" | "ready" | "withdrawing" | "done";

export interface PendingWithdraw {
  tokenSymbol: string;
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

export function loadPending(gonkaAddress: string): PendingWithdraw | null {
  try {
    const raw = localStorage.getItem(keyFor(gonkaAddress));
    return raw ? (JSON.parse(raw) as PendingWithdraw) : null;
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
