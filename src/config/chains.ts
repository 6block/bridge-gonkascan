// Central config for the bridge. Every value here was probe-verified against the
// live Gonka testnet + Sepolia on 2026-06-16 (see project memory
// reference-gonka-bridge-testnet). Do not hardcode any of these elsewhere.

const GONKA_HOST = import.meta.env.VITE_GONKA_HOST ?? "http://89.169.111.79:8000";
const SEPOLIA_RPC =
  import.meta.env.VITE_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

export interface GonkaChain {
  /** Cosmos SDK chain-id (network field from /status). */
  chainId: string;
  bech32Prefix: string;
  /** SLIP-44 coin type — NON-STANDARD (1200, not 118). Root cause of the
   *  address-mismatch fund-loss mode: Keplr derives m/44'/1200', MetaMask
   *  m/44'/60', so the same mnemonic yields different keys. */
  coinType: number;
  /** Base (smallest) denom. 1 gonka = 1e9 ngonka. */
  baseDenom: string;
  displayDenom: string;
  denomExponent: number;
  rpc: string; // Tendermint RPC (CometBFT)
  rest: string; // Cosmos + Gonka REST
  /** BLS orchestrator base — note the /v1/bls prefix, NOT /bls. */
  bls: string;
}

export interface EvmChain {
  name: string;
  /** EVM chain id, hex form used by wallet_switchEthereumChain. */
  chainIdHex: string;
  chainIdNum: number;
  /** Key used by the on-chain bridge_addresses registry. It is the STRING
   *  "sepolia"/"ethereum" — the numeric id (11155111) returns no addresses. */
  registryKey: string;
  /** Deployed BridgeContract (also the WGNK ERC-20). */
  bridgeAddress: string;
  rpcUrl: string;
  explorer: string;
}

export interface BridgeToken {
  symbol: string;
  name: string;
  /** Sepolia ERC-20 contract. */
  erc20: string;
  /** Gonka CW20 wrapped contract (bech32). */
  cw20: string;
  /** Decimals — identical on both sides (6 for USDC/USDT), so amounts map 1:1. */
  decimals: number;
}

export const GONKA: GonkaChain = {
  chainId: "gonka-testnet",
  bech32Prefix: "gonka",
  coinType: 1200,
  baseDenom: "ngonka",
  displayDenom: "gonka",
  denomExponent: 9,
  rpc: `${GONKA_HOST}/chain-rpc/`,
  rest: `${GONKA_HOST}/chain-api`,
  bls: `${GONKA_HOST}/v1/bls`,
};

export const SEPOLIA: EvmChain = {
  name: "Sepolia",
  chainIdHex: "0xaa36a7",
  chainIdNum: 11155111,
  registryKey: "sepolia",
  bridgeAddress: "0x8395733B8ecc2d1d3A7eb1b8B921d71EE4620b02",
  rpcUrl: SEPOLIA_RPC,
  explorer: "https://sepolia.etherscan.io",
};

export const TOKENS: BridgeToken[] = [
  {
    symbol: "USDC",
    name: "USD Coin (Sepolia)",
    erc20: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    cw20: "gonka1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs54lu39",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD (Sepolia)",
    erc20: "0x7169d38820dfd117c3fa1f22a697dba58d90ba06",
    cw20: "gonka1s85asu5dckeelmgzrwqakxc8tc4gllutjq4uq3a4lwak2hfp9c3qksp537",
    decimals: 6,
  },
];

export function tokenByErc20(addr: string): BridgeToken | undefined {
  const a = addr.toLowerCase();
  return TOKENS.find((t) => t.erc20.toLowerCase() === a);
}

export function tokenBySymbol(sym: string): BridgeToken | undefined {
  return TOKENS.find((t) => t.symbol === sym);
}
