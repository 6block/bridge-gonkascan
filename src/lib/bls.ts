import { decodeBase64, hexlify } from "ethers";

// The Gonka BLS orchestrator already returns EIP-2537 *uncompressed* bytes
// (group key 256B / signatures 128B), exactly the layout BridgeContract.sol
// consumes. So the client never needs a BLS curve library — only base64→hex
// with a strict length assertion. These three helpers are the whole surface.

function decodeFixed(base64: string, expectedLen: number, label: string): string {
  const bytes = decodeBase64(base64.trim());
  if (bytes.length !== expectedLen) {
    throw new Error(`${label}: expected ${expectedLen} bytes, got ${bytes.length}`);
  }
  return hexlify(bytes);
}

/** 128-byte uncompressed G1 threshold signature → 0x hex (for withdraw/mint cmd). */
export function thresholdSignatureToHex(uncompressed128Base64: string): string {
  return decodeFixed(uncompressed128Base64, 128, "BLS threshold signature");
}

/** 256-byte uncompressed G2 group public key → 0x hex (for submitGroupKey). */
export function groupKeyToHex(uncompressed256Base64: string): string {
  return decodeFixed(uncompressed256Base64, 256, "BLS group public key");
}

/** 128-byte uncompressed G1 epoch-transition validation signature → 0x hex. */
export function validationSignatureToHex(uncompressed128Base64: string): string {
  return decodeFixed(uncompressed128Base64, 128, "BLS validation signature");
}
