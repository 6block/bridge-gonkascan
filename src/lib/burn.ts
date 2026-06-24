import { SigningCosmWasmClient, type ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { GONKA } from "@/config/chains";
import { requestIdBase64ToHex } from "@/lib/requestId";

// CosmWasm signing lives in its own module so the heavy @cosmjs signing stack
// is code-split out of the main bundle and only loaded for the withdraw path.

/** Signing CosmWasm client backed by the Keplr offline signer. */
export async function getSigningClient(): Promise<SigningCosmWasmClient> {
  if (!window.keplr) throw new Error("Keplr extension not found");
  await window.keplr.enable(GONKA.chainId);
  const signer = window.keplr.getOfflineSigner(GONKA.chainId);
  return SigningCosmWasmClient.connectWithSigner(GONKA.rpc, signer, {
    gasPrice: GasPrice.fromString(`0.025${GONKA.baseDenom}`),
  });
}

export interface BurnResult {
  txHash: string;
  /** 0x-prefixed 32-byte request id, extracted from the burn tx events. */
  requestIdHex: string;
}

/**
 * Burn the wrapped CW20 to initiate a withdrawal. The CW20 contract internally
 * emits MsgRequestBridgeWithdrawal → a BLS signing request, surfaced as the
 * inference.bls.EventThresholdSigningRequested event whose request_id we return.
 */
export async function executeBurnWithdraw(params: {
  cw20: string;
  sender: string;
  amount: bigint;
  ethRecipient: string;
  bridgeAddress: string;
}): Promise<BurnResult> {
  const client = await getSigningClient();
  const msg = {
    withdraw: {
      amount: params.amount.toString(),
      destination_address: params.ethRecipient.toLowerCase(),
      destination_bridge_address: params.bridgeAddress.toLowerCase(),
    },
  };
  const result = await client.execute(params.sender, params.cw20, msg, "auto");
  const requestIdHex = extractRequestId(result);
  if (!requestIdHex) {
    throw new Error("Burn succeeded but no request_id event was found in the tx");
  }
  return { txHash: result.transactionHash, requestIdHex };
}

/** Pull the BLS request_id out of the EventThresholdSigningRequested event. */
function extractRequestId(result: ExecuteResult): string | null {
  for (const ev of result.events) {
    if (!ev.type.endsWith("EventThresholdSigningRequested")) continue;
    const attr = ev.attributes.find((a) => a.key === "request_id");
    if (!attr) continue;
    // Typed-event values are JSON-marshaled, so a base64 string arrives quoted.
    let v = attr.value.trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return requestIdBase64ToHex(v);
  }
  return null;
}
