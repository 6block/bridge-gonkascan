import { truncate } from "@/lib/format";
import { useWallet } from "./WalletContext";
import "./wallet.css";

/**
 * Hard-block banner for the address-mismatch fund-loss mode. Renders only when
 * both wallets are connected AND the EVM address derived from the Keplr pubkey
 * does not equal the active MetaMask address. The app must disable all
 * deposit/withdraw actions while this is showing.
 */
export function AddressGuardBanner() {
  const { guard } = useWallet();
  if (!guard || guard.match) return null;

  return (
    <div className="guard-banner" role="alert">
      <div className="guard-banner__title">⚠ Address mismatch — bridging is blocked</div>
      <p className="guard-banner__body">
        Your Keplr account derives a different Ethereum address than the one MetaMask is on. Gonka
        uses coin type 1200 while Ethereum uses 60, so the same seed produces different keys.
        Bridging now could send funds to an address you don't control.
      </p>
      <div className="guard-banner__rows">
        <div>
          <span className="guard-banner__k">Keplr-derived EVM</span>
          <span className="mono">{truncate(guard.derivedEvm, 10, 8)}</span>
        </div>
        <div>
          <span className="guard-banner__k">MetaMask active</span>
          <span className="mono">{truncate(guard.metamask, 10, 8)}</span>
        </div>
      </div>
      <p className="guard-banner__fix">
        Switch MetaMask to the account that matches your Keplr key, or vice-versa, then reconnect.
      </p>
    </div>
  );
}
