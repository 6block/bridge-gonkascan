import { GONKA } from "@/config/chains";

// Read-only HTTP helpers for the Gonka chain REST + BLS orchestrator.
// All probe-verified against http://89.169.111.79:8000 on 2026-06-16.

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// ---- bridge address registry --------------------------------------------
export interface BridgeAddressEntry {
  id: string;
  chainId: string;
  address: string;
}

export async function getBridgeAddresses(registryKey: string): Promise<BridgeAddressEntry[]> {
  const data = await getJson<{ addresses?: BridgeAddressEntry[] }>(
    `${GONKA.rest}/productscience/inference/inference/bridge_addresses/${registryKey}`,
  );
  return data.addresses ?? [];
}

// ---- native GNK balance (withdraw gas pre-check) -------------------------
export async function getNativeGnkBalance(address: string): Promise<bigint> {
  try {
    const data = await getJson<{ balances?: { denom: string; amount: string }[] }>(
      `${GONKA.rest}/cosmos/bank/v1beta1/balances/${address}`,
    );
    const entry = data.balances?.find((b) => b.denom === GONKA.baseDenom);
    return entry ? BigInt(entry.amount) : 0n;
  } catch {
    return 0n;
  }
}

// ---- current epoch (for the bridge epoch-sync gate) ----------------------
// NOTE: shape confirmed at runtime in Phase 1 verification; parsed defensively.
export async function getCurrentGonkaEpoch(): Promise<number | null> {
  try {
    const data = await getJson<Record<string, any>>(
      `${GONKA.rest}/productscience/inference/inference/current_epoch_group_data`,
    );
    // epoch_index is the canonical epoch counter (probe-verified to match the
    // bridge contract's epochId on both testnet and mainnet). Prefer it.
    const raw =
      data?.epoch_group_data?.epoch_index ??
      data?.epoch_group_data?.epoch_id ??
      data?.epoch_index;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// ---- CW20 wrapped-token reads -------------------------------------------
export interface Cw20TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
}

function smartQueryUrl(contract: string, query: object): string {
  const b64 = btoa(JSON.stringify(query));
  return `${GONKA.rest}/cosmwasm/wasm/v1/contract/${contract}/smart/${b64}`;
}

export async function getCw20TokenInfo(cw20: string): Promise<Cw20TokenInfo> {
  const data = await getJson<{ data: Cw20TokenInfo }>(
    smartQueryUrl(cw20, { token_info: {} }),
  );
  return data.data;
}

export async function getCw20Balance(cw20: string, address: string): Promise<string> {
  const data = await getJson<{ data: { balance: string } }>(
    smartQueryUrl(cw20, { balance: { address } }),
  );
  return data.data.balance;
}

// ---- BLS orchestrator ----------------------------------------------------
export interface BlsEpochData {
  group_public_key_uncompressed_256: string | null; // base64
  validation_signature_uncompressed_128: string | null; // base64
  epoch_data: Record<string, unknown>;
}

export async function getBlsEpoch(epochId: number): Promise<BlsEpochData> {
  return getJson<BlsEpochData>(`${GONKA.bls}/epochs/${epochId}`);
}

export const ThresholdStatus = {
  PENDING: 1,
  PARTIAL: 2,
  COMPLETED: 3,
  FAILED: 4,
} as const;

export interface BlsSignatureResult {
  signing_request: {
    status?: number | string;
    current_epoch_id?: number | string;
    request_id?: string;
  } | null;
  uncompressed_signature_128: string | null; // base64, present only when COMPLETED
}

export async function getBlsSignature(hexRequestId: string): Promise<BlsSignatureResult> {
  return getJson<BlsSignatureResult>(`${GONKA.bls}/signatures/${hexRequestId}`);
}

/** Normalize the status field (string enum or number) to our numeric codes. */
export function normalizeStatus(status: number | string | undefined): number {
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    if (status.includes("COMPLETED")) return ThresholdStatus.COMPLETED;
    if (status.includes("FAILED")) return ThresholdStatus.FAILED;
    if (status.includes("PARTIAL")) return ThresholdStatus.PARTIAL;
    if (status.includes("PENDING")) return ThresholdStatus.PENDING;
  }
  return 0;
}
