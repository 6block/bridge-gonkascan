import { WalletProvider, useWallet } from "@/features/wallet/WalletContext";
import { WalletBar } from "@/features/wallet/WalletBar";
import { AddressGuardBanner } from "@/features/wallet/AddressGuardBanner";
import { StatusPanel } from "@/features/status/StatusPanel";
import { BridgePanel } from "@/features/bridge/BridgePanel";
import { Pill } from "@/components/ui/Pill";
import { GONKA } from "@/config/chains";
import "./App.css";

function Shell() {
  const { error } = useWallet();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden />
          <div className="brand__text">
            <span className="brand__name">Gonka Bridge</span>
            <span className="brand__net">
              <Pill tone="accent">{GONKA.chainId}</Pill>
            </span>
          </div>
        </div>
        <WalletBar />
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero__title">
            Move assets across <span className="hero__accent">Ethereum</span> and{" "}
            <span className="hero__accent">Gonka</span>
          </h1>
          <p className="hero__sub">
            Bridge USDC and USDT between Sepolia and the Gonka network, secured by validator BLS
            threshold signatures.
          </p>
        </section>

        {error && <div className="toast toast--err">{error}</div>}
        <AddressGuardBanner />

        <div className="layout">
          <BridgePanel />
          <StatusPanel />
        </div>
      </main>

      <footer className="footer">
        <span>bridge.gonkascan.com</span>
        <span className="footer__dim">Testnet · funds at your own risk</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <Shell />
    </WalletProvider>
  );
}
