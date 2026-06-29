import { WalletProvider, useWallet } from "@/features/wallet/WalletContext";
import { WalletBar } from "@/features/wallet/WalletBar";
import { AddressGuardBanner } from "@/features/wallet/AddressGuardBanner";
import { StatusPanel } from "@/features/status/StatusPanel";
import { BridgePanel } from "@/features/bridge/BridgePanel";
import { ParticleField } from "@/components/background/ParticleField";
import { BrandMark } from "@/components/ui/BrandMark";
import { EVM, GONKA } from "@/config/chains";
import "./App.css";

function Shell() {
  const { error } = useWallet();

  return (
    <div className="shell">
      <ParticleField />

      <div className="shell__inner">
        <header className="topbar">
          <div className="brand">
            <BrandMark />
            <div className="brand__text">
              <span className="brand__name">Gonka Bridge</span>
              <span className="brand__net mono">{GONKA.chainId}</span>
            </div>
          </div>
          <WalletBar />
        </header>

        <main className="main">
          <div className="hero-grid">
            <section className="hero">
              <h1 className="hero__title">
                Move value between <span className="hero__accent">Ethereum</span> and{" "}
                <span className="hero__accent">Gonka</span>
              </h1>
              <p className="hero__sub">
                Bridge GNK, USDC, and USDT across {EVM.name} and the Gonka network. Non-custodial,
                1:1, and finalized by a validator BLS threshold signature.
              </p>
              <ul className="hero__trust">
                <li>Non-custodial</li>
                <li>1:1 backed</li>
                <li>BLS threshold-secured</li>
              </ul>
            </section>

            <div className="hero-action">
              {error && (
                <div className="toast toast--err" role="alert">
                  {error}
                </div>
              )}
              <AddressGuardBanner />
              <BridgePanel />
            </div>
          </div>

          <StatusPanel />
        </main>

        <footer className="footer">
          <span>bridge.gonkascan.com</span>
          <span className="footer__dim">Testnet · funds at your own risk</span>
        </footer>
      </div>
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
