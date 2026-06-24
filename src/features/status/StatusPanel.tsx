import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EVM } from "@/config/chains";
import { truncate } from "@/lib/format";
import { useBridgeStatus } from "@/hooks/useBridgeStatus";
import "./status.css";

export function StatusPanel() {
  const { data, loading, error, refresh } = useBridgeStatus();

  return (
    <Card
      title="Bridge status"
      action={
        <Button variant="ghost" size="sm" loading={loading} onClick={refresh}>
          Refresh
        </Button>
      }
    >
      {error && <p className="status__error">{error}</p>}
      {!error && !data && loading && <p className="status__muted">Reading on-chain state…</p>}

      {data && (
        <div className="status__grid">
          <Row label={`Contract (${EVM.name})`}>
            <a
              className="mono"
              href={`${EVM.explorer}/address/${EVM.bridgeAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(EVM.bridgeAddress, 10, 8)}
            </a>
          </Row>

          <Row label="Operational state">
            {data.bridge.stateLabel === "NORMAL_OPERATION" ? (
              <Pill tone="ok">NORMAL_OPERATION</Pill>
            ) : (
              <Pill tone="bad">ADMIN_CONTROL</Pill>
            )}
          </Row>

          <Row label="Epoch sync">
            <span className="status__epochs">
              <span className="mono">
                bridge {data.bridge.latestEpochId.toString()} / gonka{" "}
                {data.gonkaEpoch ?? "—"}
              </span>
              {data.epochInSync === null ? (
                <Pill tone="warn">unknown</Pill>
              ) : data.epochInSync ? (
                <Pill tone="ok">in sync</Pill>
              ) : (
                <Pill tone="bad">behind</Pill>
              )}
            </span>
          </Row>

          <Row label={`Registered (${data.registered.length})`}>
            <div className="status__addrs">
              {data.registered.map((a) => (
                <code key={a.id} className="status__addr">
                  {truncate(a.address, 8, 6)}
                </code>
              ))}
            </div>
          </Row>
        </div>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="status__row">
      <span className="status__label">{label}</span>
      <span className="status__value">{children}</span>
    </div>
  );
}
