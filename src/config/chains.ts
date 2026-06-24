// Central config. Two network presets — testnet (Gonka testnet + Sepolia) and
// mainnet (Gonka mainnet + Ethereum) — selected by VITE_NETWORK. Every value was
// probe-verified against the live chains (see project memory). Do not hardcode
// any of these elsewhere.

type NetworkName = "testnet" | "mainnet";
export const NETWORK: NetworkName =
  import.meta.env.VITE_NETWORK === "mainnet" ? "mainnet" : "testnet";

export interface GonkaChain {
  /** Cosmos SDK chain-id (network field from /status). */
  chainId: string;
  bech32Prefix: string;
  /** SLIP-44 coin type — NON-STANDARD (1200). Root of the address-mismatch
   *  fund-loss mode: Keplr derives m/44'/1200', MetaMask m/44'/60'. Same on
   *  testnet and mainnet (one binary, compile-time constant). */
  coinType: number;
  baseDenom: string; // 1 gonka = 1e9 ngonka
  displayDenom: string;
  denomExponent: number;
  rpc: string; // Tendermint RPC
  rest: string; // Cosmos + Gonka REST
  bls: string; // BLS orchestrator (note the /v1/bls prefix)
}

export interface EvmChain {
  name: string;
  chainIdHex: string; // for wallet_switchEthereumChain
  chainIdNum: number;
  /** Key the on-chain bridge_addresses registry uses (string, not numeric). */
  registryKey: string;
  /** Deployed BridgeContract (also the WGNK ERC-20). */
  bridgeAddress: string;
  rpcUrl: string;
  explorer: string;
}

export interface BridgeToken {
  symbol: string;
  name: string;
  /** "cw20" = foreign ERC-20 wrapped as a CW20 on Gonka (USDC/USDT). "native" =
   *  Gonka's own GNK, wrapped as WGNK (the bridge contract itself) on Ethereum. */
  kind: "cw20" | "native";
  /** Ethereum ERC-20 contract. For native GNK this is the bridge/WGNK address. */
  erc20: string;
  /** Gonka CW20 wrapped contract (bech32). Empty for native GNK (uses bank balance). */
  cw20: string;
  /** Decimals — identical on both sides (6 for USDC/USDT, 9 for GNK/WGNK), 1:1. */
  decimals: number;
}

interface NetworkConfig {
  gonka: GonkaChain;
  evm: EvmChain;
  tokens: BridgeToken[];
}

// Optional env overrides for the active network's endpoints.
const GONKA_HOST_OVERRIDE = import.meta.env.VITE_GONKA_HOST;
const EVM_RPC_OVERRIDE = import.meta.env.VITE_EVM_RPC_URL;

function gonkaChain(host: string, chainId: string): GonkaChain {
  const base = GONKA_HOST_OVERRIDE ?? host;
  return {
    chainId,
    bech32Prefix: "gonka",
    coinType: 1200,
    baseDenom: "ngonka",
    displayDenom: "gonka",
    denomExponent: 9,
    rpc: `${base}/chain-rpc/`,
    rest: `${base}/chain-api`,
    bls: `${base}/v1/bls`,
  };
}

const TESTNET_BRIDGE = "0x8395733B8ecc2d1d3A7eb1b8B921d71EE4620b02";
const MAINNET_BRIDGE = "0x972a7a92d92796a98801a8818bcf91f1648f2f68";

const TESTNET: NetworkConfig = {
  gonka: gonkaChain("http://89.169.111.79:8000", "gonka-testnet"),
  evm: {
    name: "Sepolia",
    chainIdHex: "0xaa36a7",
    chainIdNum: 11155111,
    registryKey: "sepolia",
    bridgeAddress: TESTNET_BRIDGE,
    rpcUrl: EVM_RPC_OVERRIDE ?? "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
  },
  tokens: [
    { symbol: "GNK", name: "Gonka (native ↔ WGNK)", kind: "native", erc20: TESTNET_BRIDGE, cw20: "", decimals: 9 },
    {
      symbol: "USDC",
      name: "USD Coin (Sepolia)",
      kind: "cw20",
      erc20: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
      cw20: "gonka1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs54lu39",
      decimals: 6,
    },
    {
      symbol: "USDT",
      name: "Tether USD (Sepolia)",
      kind: "cw20",
      erc20: "0x7169d38820dfd117c3fa1f22a697dba58d90ba06",
      cw20: "gonka1s85asu5dckeelmgzrwqakxc8tc4gllutjq4uq3a4lwak2hfp9c3qksp537",
      decimals: 6,
    },
  ],
};

const MAINNET: NetworkConfig = {
  gonka: gonkaChain("https://node1.gonka.ai:8443", "gonka-mainnet"),
  evm: {
    name: "Ethereum",
    chainIdHex: "0x1",
    chainIdNum: 1,
    registryKey: "ethereum",
    bridgeAddress: MAINNET_BRIDGE,
    rpcUrl: EVM_RPC_OVERRIDE ?? "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
  },
  tokens: [
    { symbol: "GNK", name: "Gonka (native ↔ WGNK)", kind: "native", erc20: MAINNET_BRIDGE, cw20: "", decimals: 9 },
    {
      symbol: "USDC",
      name: "USD Coin",
      kind: "cw20",
      erc20: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      cw20: "gonka1fa83z7np903k9vh63guy82qthtv373d7vjeq0y7xeqh50rzn8vtssffkre",
      decimals: 6,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      kind: "cw20",
      erc20: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      cw20: "gonka15ggwj9un6qrmu4nj5ev6l7kpdcr00td03ff2mmj4cyhl8u8vjd2qnl3hgk",
      decimals: 6,
    },
  ],
};

const active = NETWORK === "mainnet" ? MAINNET : TESTNET;

// On mainnet every endpoint must be HTTPS — a stray http:// override (e.g. a
// misconfigured VITE_GONKA_HOST) would broadcast signed txs over plaintext.
if (NETWORK === "mainnet") {
  for (const url of [active.gonka.rpc, active.gonka.rest, active.gonka.bls, active.evm.rpcUrl]) {
    if (url.startsWith("http://")) {
      throw new Error(`Mainnet requires HTTPS endpoints; got insecure ${url}`);
    }
  }
}

export const GONKA = active.gonka;
export const EVM = active.evm;
export const TOKENS = active.tokens;

export function tokenByErc20(addr: string): BridgeToken | undefined {
  const a = addr.toLowerCase();
  return TOKENS.find((t) => t.erc20.toLowerCase() === a);
}

export function tokenBySymbol(sym: string): BridgeToken | undefined {
  return TOKENS.find((t) => t.symbol === sym);
}
