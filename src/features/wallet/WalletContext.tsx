import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider } from "ethers";
import { ensureSepolia, getInjectedProvider } from "@/lib/evm";
import { connectKeplr } from "@/lib/cosmos";
import { checkAddressMatch, type AddressGuardResult } from "@/lib/addressGuard";

interface EvmState {
  address: string;
  provider: BrowserProvider;
}
interface GonkaState {
  address: string;
  pubKey: Uint8Array;
}

interface WalletContextValue {
  evm: EvmState | null;
  gonka: GonkaState | null;
  guard: AddressGuardResult | null;
  connectingEvm: boolean;
  connectingGonka: boolean;
  error: string | null;
  connectEvm: () => Promise<void>;
  connectGonka: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const METAMASK_INSTALL_URL = "https://metamask.io/download/";
const KEPLR_INSTALL_URL = "https://www.keplr.app/get";

function openInstall(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [evm, setEvm] = useState<EvmState | null>(null);
  const [gonka, setGonka] = useState<GonkaState | null>(null);
  const [connectingEvm, setConnectingEvm] = useState(false);
  const [connectingGonka, setConnectingGonka] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectEvm = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      openInstall(METAMASK_INSTALL_URL);
      setError("MetaMask not detected — opening the install page in a new tab.");
      return;
    }
    setConnectingEvm(true);
    try {
      const provider = getInjectedProvider();
      await provider.send("eth_requestAccounts", []);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      setEvm({ address: await signer.getAddress(), provider });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect MetaMask");
    } finally {
      setConnectingEvm(false);
    }
  }, []);

  const connectGonka = useCallback(async () => {
    setError(null);
    if (!window.keplr) {
      openInstall(KEPLR_INSTALL_URL);
      setError("Keplr not detected — opening the install page in a new tab.");
      return;
    }
    setConnectingGonka(true);
    try {
      const acct = await connectKeplr();
      setGonka({ address: acct.bech32Address, pubKey: acct.pubKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Keplr");
    } finally {
      setConnectingGonka(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setEvm(null);
    setGonka(null);
    setError(null);
  }, []);

  // React to wallet account/network changes from MetaMask.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      if (!list || list.length === 0) setEvm(null);
      else void connectEvm();
    };
    const onChain = () => void connectEvm();
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [connectEvm]);

  // Re-sync the Keplr account if the user switches it.
  useEffect(() => {
    const handler = () => void connectGonka();
    window.addEventListener("keplr_keystorechange", handler);
    return () => window.removeEventListener("keplr_keystorechange", handler);
  }, [connectGonka]);

  const guard = useMemo<AddressGuardResult | null>(() => {
    if (!evm || !gonka) return null;
    return checkAddressMatch(evm.address, gonka.pubKey);
  }, [evm, gonka]);

  const value = useMemo<WalletContextValue>(
    () => ({
      evm,
      gonka,
      guard,
      connectingEvm,
      connectingGonka,
      error,
      connectEvm,
      connectGonka,
      disconnect,
    }),
    [evm, gonka, guard, connectingEvm, connectingGonka, error, connectEvm, connectGonka, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
