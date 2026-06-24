import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { GONKA } from "@/config/chains";
import { requestIdBase64ToHex } from "@/lib/requestId";
import { MSG_REQUEST_BRIDGE_MINT_TYPE_URL, getSigningStargateClient } from "@/lib/proto";

// CosmWasm/Stargate signing lives in its own module so the heavy @cosmjs signing
// stack is code-split out of the main bundle and only loaded for the withdraw path.

interface EventLike {
  type: string;
  attributes: readonly { key: string; value: string }[];
}

export interface BurnResult {
  txHash: string;
  /** 0x-prefixed 32-byte request id, extracted from the burn tx events. */
  requestIdHex: string;
}

/** Signing CosmWasm client backed by the Keplr offline signer (CW20 path). */
async function getSigningClient(): Promise<SigningCosmWasmClient> {
  if (!window.keplr) throw new Error("Keplr extension not found");
  await window.keplr.enable(GONKA.chainId);
  const signer = window.keplr.getOfflineSigner(GONKA.chainId);
  return SigningCosmWasmClient.connectWithSigner(GONKA.rpc, signer, {
    gasPrice: GasPrice.fromString(`0.025${GONKA.baseDenom}`),
  });
}

/**
 * CW20 path (USDC/USDT): burn the wrapped token via MsgExecuteContract. The CW20
 * internally emits MsgRequestBridgeWithdrawal → a BLS signing request.
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
  return finishBurn(result.transactionHash, result.events);
}

/**
 * Native path (GNK → WGNK): the user signs MsgRequestBridgeMint directly, which
 * escrows native GNK and emits a BLS signing request to mint WGNK on Ethereum.
 */
export async function executeNativeBridgeMint(params: {
  sender: string;
  amount: bigint;
  ethRecipient: string;
  bridgeAddress: string;
  chainId: string;
}): Promise<BurnResult> {
  const client = await getSigningStargateClient();
  const msg = {
    typeUrl: MSG_REQUEST_BRIDGE_MINT_TYPE_URL,
    value: {
      creator: params.sender,
      amount: params.amount.toString(),
      destinationAddress: params.ethRecipient,
      chainId: params.chainId,
      destinationBridgeAddress: params.bridgeAddress.toLowerCase(),
    },
  };
  const result = await client.signAndBroadcast(params.sender, [msg], "auto");
  if (result.code !== 0) {
    throw new Error(`Bridge mint failed (code ${result.code}): ${result.rawLog ?? ""}`);
  }
  return finishBurn(result.transactionHash, result.events);
}

function finishBurn(txHash: string, events: readonly EventLike[]): BurnResult {
  const requestIdHex = extractRequestId(events);
  if (!requestIdHex) {
    throw new Error("Burn succeeded but no request_id event was found in the tx");
  }
  return { txHash, requestIdHex };
}

/** Pull the BLS request_id out of the EventThresholdSigningRequested event. */
function extractRequestId(events: readonly EventLike[]): string | null {
  for (const ev of events) {
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
