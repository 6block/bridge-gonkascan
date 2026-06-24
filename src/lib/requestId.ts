import { decodeBase64, hexlify } from "ethers";

/**
 * Convert the base64 `request_id` emitted by a Gonka burn/withdraw tx into the
 * 0x-prefixed 32-byte hex the BLS orchestrator and EVM contract expect.
 *
 * CRITICAL (fund-loss gate #3): the only transform is base64-decode → bytes → hex.
 * Any extra hashing (keccak256 / sha256) corrupts the id, the BLS poll never
 * resolves, and the withdrawal cannot be completed. Do NOT add hashing here.
 */
export function requestIdBase64ToHex(base64RequestId: string): string {
  const clean = base64RequestId.trim();
  const bytes = decodeBase64(clean);
  if (bytes.length !== 32) {
    throw new Error(
      `Invalid requestId length: expected 32 bytes, got ${bytes.length} (input "${clean}")`,
    );
  }
  return hexlify(bytes);
}

/** Strip the leading 0x — the BLS orchestrator path wants bare hex. */
export function toBareHex(hex0x: string): string {
  return hex0x.startsWith("0x") ? hex0x.slice(2) : hex0x;
}
