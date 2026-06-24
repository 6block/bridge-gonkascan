import { BinaryReader, BinaryWriter } from "cosmjs-types/binary";
import { Registry, type GeneratedType } from "@cosmjs/proto-signing";
import { defaultRegistryTypes, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { GONKA } from "@/config/chains";

// Gonka's native bridge unwrap message (GNK → WGNK). It's a custom chain type
// CosmJS doesn't know, so we register a minimal proto codec for it. All five
// fields are proto3 strings (field numbers 1–5); tags 10/18/26/34/42.

export const MSG_REQUEST_BRIDGE_MINT_TYPE_URL = "/inference.inference.MsgRequestBridgeMint";

export interface MsgRequestBridgeMint {
  creator: string;
  amount: string;
  destinationAddress: string;
  chainId: string;
  destinationBridgeAddress: string;
}

export const MsgRequestBridgeMintType: GeneratedType = {
  typeUrl: MSG_REQUEST_BRIDGE_MINT_TYPE_URL,
  encode(
    message: Partial<MsgRequestBridgeMint>,
    writer: BinaryWriter = BinaryWriter.create(),
  ): BinaryWriter {
    if (message.creator) writer.uint32(10).string(message.creator);
    if (message.amount) writer.uint32(18).string(message.amount);
    if (message.destinationAddress) writer.uint32(26).string(message.destinationAddress);
    if (message.chainId) writer.uint32(34).string(message.chainId);
    if (message.destinationBridgeAddress)
      writer.uint32(42).string(message.destinationBridgeAddress);
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number): MsgRequestBridgeMint {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const msg: MsgRequestBridgeMint = {
      creator: "",
      amount: "",
      destinationAddress: "",
      chainId: "",
      destinationBridgeAddress: "",
    };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          msg.creator = reader.string();
          break;
        case 2:
          msg.amount = reader.string();
          break;
        case 3:
          msg.destinationAddress = reader.string();
          break;
        case 4:
          msg.chainId = reader.string();
          break;
        case 5:
          msg.destinationBridgeAddress = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
      }
    }
    return msg;
  },
  fromPartial(object: Partial<MsgRequestBridgeMint>): MsgRequestBridgeMint {
    return {
      creator: object.creator ?? "",
      amount: object.amount ?? "",
      destinationAddress: object.destinationAddress ?? "",
      chainId: object.chainId ?? "",
      destinationBridgeAddress: object.destinationBridgeAddress ?? "",
    };
  },
};

/** Stargate signing client (Keplr signer) with the custom mint type registered. */
export async function getSigningStargateClient(): Promise<SigningStargateClient> {
  if (!window.keplr) throw new Error("Keplr extension not found");
  await window.keplr.enable(GONKA.chainId);
  const signer = window.keplr.getOfflineSigner(GONKA.chainId);
  const registry = new Registry([
    ...defaultRegistryTypes,
    [MSG_REQUEST_BRIDGE_MINT_TYPE_URL, MsgRequestBridgeMintType],
  ]);
  return SigningStargateClient.connectWithSigner(GONKA.rpc, signer, {
    registry,
    gasPrice: GasPrice.fromString(`0.025${GONKA.baseDenom}`),
  });
}
