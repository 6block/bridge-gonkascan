/// <reference types="vite/client" />

import type { Eip1193Provider } from "ethers";

interface ImportMetaEnv {
  readonly VITE_SEPOLIA_RPC_URL?: string;
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
