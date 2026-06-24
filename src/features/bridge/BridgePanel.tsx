import { lazy, Suspense, useState } from "react";
import { Card } from "@/components/ui/Card";
import { DepositForm } from "@/features/deposit/DepositForm";
import "./bridge.css";

// Withdraw pulls in the heavy @cosmjs signing stack — load it only on demand so
// the initial bundle (deposit + status) stays light.
const WithdrawForm = lazy(() =>
  import("@/features/withdraw/WithdrawForm").then((m) => ({ default: m.WithdrawForm })),
);

type Tab = "deposit" | "withdraw";

export function BridgePanel() {
  const [tab, setTab] = useState<Tab>("deposit");

  return (
    <Card
      action={
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "deposit"}
            className={`tabs__btn${tab === "deposit" ? " tabs__btn--on" : ""}`}
            onClick={() => setTab("deposit")}
          >
            Deposit
          </button>
          <button
            role="tab"
            aria-selected={tab === "withdraw"}
            className={`tabs__btn${tab === "withdraw" ? " tabs__btn--on" : ""}`}
            onClick={() => setTab("withdraw")}
          >
            Withdraw
          </button>
        </div>
      }
    >
      {tab === "deposit" ? (
        <DepositForm />
      ) : (
        <Suspense fallback={<p className="tabs__loading">Loading withdraw…</p>}>
          <WithdrawForm />
        </Suspense>
      )}
    </Card>
  );
}
