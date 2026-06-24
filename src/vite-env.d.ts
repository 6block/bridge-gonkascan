/// <reference types="vite/client" />

import type { Eip1193Provider } from "ethers";

interface ImportMetaEnv {
  /** "testnet" (default) | "mainnet" — selects the network preset. */
  readonly VITE_NETWORK?: string;
  /** Override the active EVM chain's JSON-RPC URL. */
  readonly VITE_EVM_RPC_URL?: string;
  /** Override the active Gonka host (chain RPC + REST + BLS live here). */
  readonly VITE_GONKA_HOST?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected wallet providers. Keplr's surface is large and untyped here on
// purpose — we only touch a handful of methods, narrowed at call sites.
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
    keplr?: any;
    getOfflineSignerAuto?: unknown;
  }
}

declare module "*.json" {
  const value: any;
  export default value;
}
