import { Button } from "@/components/ui/Button";
import { truncate } from "@/lib/format";
import { useWallet } from "./WalletContext";
import "./wallet.css";

function WalletChip({ kind, address }: { kind: string; address: string }) {
  return (
    <div className="wchip">
      <span className="wchip__kind">{kind}</span>
      <span className="wchip__addr mono">{truncate(address)}</span>
    </div>
  );
}

export function WalletBar() {
  const { evm, gonka, connectEvm, connectGonka, connectingEvm, connectingGonka, disconnect } =
    useWallet();

  return (
    <div className="walletbar">
      {evm ? (
        <WalletChip kind="MetaMask" address={evm.address} />
      ) : (
        <Button variant="ghost" size="sm" onClick={connectEvm} disabled={connectingEvm}>
          {connectingEvm ? "Connecting…" : "Connect MetaMask"}
        </Button>
      )}
      {gonka ? (
        <WalletChip kind="Keplr" address={gonka.address} />
      ) : (
        <Button variant="ghost" size="sm" onClick={connectGonka} disabled={connectingGonka}>
          {connectingGonka ? "Connecting…" : "Connect Keplr"}
        </Button>
      )}
      {(evm || gonka) && (
        <button className="walletbar__disc" onClick={disconnect} title="Disconnect">
          ✕
        </button>
      )}
    </div>
  );
}
