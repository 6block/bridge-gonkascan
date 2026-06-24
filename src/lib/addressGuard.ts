import { computeAddress, hexlify } from "ethers";

// Fund-loss gate #1 — address mismatch.
//
// Gonka uses SLIP-44 coin type 1200; Ethereum uses 60. The same mnemonic
// therefore derives DIFFERENT secp256k1 keys in Keplr vs MetaMask. If a user
// bridges while the two wallets are on unrelated keys, minted/wrapped tokens
// land on an address they cannot control. We defend by deriving the EVM address
// implied by the connected Keplr account's public key and requiring it to equal
// the connected MetaMask address before any deposit/withdraw is allowed.

/** EVM address implied by a Keplr secp256k1 public key (compressed, 33 bytes). */
export function evmAddressFromPubkey(pubKey: Uint8Array): string {
  return computeAddress(hexlify(pubKey));
}

export interface AddressGuardResult {
  match: boolean;
  derivedEvm: string;
  metamask: string;
}

export function checkAddressMatch(
  metamaskAddress: string,
  keplrPubKey: Uint8Array,
): AddressGuardResult {
  const derivedEvm = evmAddressFromPubkey(keplrPubKey);
  return {
    match: derivedEvm.toLowerCase() === metamaskAddress.toLowerCase(),
    derivedEvm,
    metamask: metamaskAddress,
  };
}
