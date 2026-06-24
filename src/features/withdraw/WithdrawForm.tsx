import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TokenAmountField } from "@/components/ui/TokenAmountField";
import { SEPOLIA, TOKENS, tokenBySymbol } from "@/config/chains";
import { formatUnits, parseUnits, truncate } from "@/lib/format";
import { getNativeGnkBalance } from "@/lib/gonka";
import { useWallet } from "@/features/wallet/WalletContext";
import { useBalances } from "@/features/deposit/useBalances";
import { useWithdraw, type WithdrawStatus } from "./useWithdraw";
import "./withdraw.css";

const BUSY: ReadonlySet<WithdrawStatus> = new Set([
  "burning",
  "polling",
  "catchup",
  "withdrawing",
]);

export function WithdrawForm() {
  const { evm, gonka, guard } = useWallet();
  const [symbol, setSymbol] = useState(TOKENS[0].symbol);
  const [amount, setAmount] = useState("");
  const token = tokenBySymbol(symbol) ?? TOKENS[0];

  const balances = useBalances(token, evm?.address ?? null, gonka?.address ?? null);
  const w = useWithdraw(token, evm?.provider ?? null, gonka?.address ?? null, evm?.address ?? null);

  // Pre-check native GNK: a freshly-bridged account holds only CW20 and can't
  // pay gas for the burn, so warn before the user hits a failed signature.
  const [hasGas, setHasGas] = useState<boolean | null>(null);
  useEffect(() => {
    if (!gonka?.address) return setHasGas(null);
    let alive = true;
    void getNativeGnkBalance(gonka.address).then((b) => alive && setHasGas(b > 0n));
    return () => {
      alive = false;
    };
  }, [gonka?.address, w.status]);

  const { parsed, parseError } = useMemo(() => {
    if (!amount.trim()) return { parsed: null, parseError: null };
    try {
      return { parsed: parseUnits(amount, token.decimals), parseError: null };
    } catch (e) {
      return { parsed: null, parseError: e instanceof Error ? e.message : "Invalid amount" };
    }
  }, [amount, token.decimals]);

  const busy = BUSY.has(w.status);
  const overBalance = parsed !== null && balances.gonka !== null && parsed > balances.gonka;
  const noGas = hasGas === false;
  const ready = Boolean(evm && gonka && guard?.match);
  const canWithdraw = ready && parsed !== null && parsed > 0n && !overBalance && !busy && !noGas;

  const blocker = !gonka
    ? "Connect Keplr to withdraw"
    : !evm
      ? "Connect MetaMask to set your Sepolia recipient"
      : !guard?.match
        ? "Address mismatch — resolve the warning above"
        : null;

  // Offer to resume an interrupted withdrawal captured in localStorage.
  const resumable =
    w.status === "idle" && w.pending && w.pending.step !== "done" ? w.pending : null;

  if (resumable) {
    return (
      <div className="withdraw">
        <div className="wd-resume">
          <Pill tone="warn">interrupted withdrawal</Pill>
          <p>
            A withdrawal of <span className="mono">{formatUnits(resumable.amount, token.decimals)}</span>{" "}
            {resumable.tokenSymbol} is still in progress (
            {resumable.step === "polling" ? "awaiting BLS signature" : "ready to release on Sepolia"}
            ). Resume it before starting a new one.
          </p>
          <div className="wd-resume__row">
            <Button variant="primary" size="sm" onClick={w.resume}>
              Resume
            </Button>
            <Button variant="ghost" size="sm" onClick={w.dismiss}>
              Discard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="withdraw">
      <TokenAmountField
        tokens={TOKENS}
        token={token}
        onTokenChange={setSymbol}
        amount={amount}
        onAmountChange={setAmount}
        balance={balances.gonka}
        balanceLabel="Gonka balance"
        disabled={busy}
      />

      <div className="wd-route">
        <span className="wd-route__leg">
          <span className="wd-route__chain">Gonka</span>
          <span className="wd-route__sub">{token.symbol}</span>
        </span>
        <span className="wd-route__arrow">→</span>
        <span className="wd-route__leg wd-route__leg--to">
          <span className="wd-route__chain">Sepolia</span>
          <span className="wd-route__sub">{evm ? truncate(evm.address, 8, 6) : "connect MetaMask"}</span>
        </span>
      </div>

      {parseError && <p className="wd-warn">{parseError}</p>}
      {overBalance && <p className="wd-warn">Amount exceeds your Gonka balance.</p>}
      {ready && noGas && (
        <div className="wd-gas">
          <Pill tone="warn">no gas</Pill>
          <p>
            This Gonka account has no native GNK to pay for the burn. Send a little GNK to{" "}
            <span className="mono">{truncate(gonka!.address, 10, 8)}</span>, then it'll unlock.
          </p>
        </div>
      )}

      {blocker ? (
        <Button variant="ghost" disabled>
          {blocker}
        </Button>
      ) : (
        <Button
          variant="primary"
          loading={busy}
          disabled={!canWithdraw}
          onClick={() => parsed && w.withdraw(parsed)}
        >
          {statusLabel(w.status, token.symbol)}
        </Button>
      )}

      <WithdrawProgress
        status={w.status}
        note={w.note}
        gonkaTxHash={w.pending?.gonkaTxHash ?? null}
        ethereumTxHash={w.ethereumTxHash}
        error={w.error}
        amount={w.pending ? formatUnits(w.pending.amount, token.decimals) : null}
        symbol={token.symbol}
        onDone={() => {
          setAmount("");
          balances.refresh();
          w.dismiss();
        }}
      />
    </div>
  );
}

function statusLabel(status: WithdrawStatus, sym: string): string {
  switch (status) {
    case "burning":
      return "Confirm burn in Keplr…";
    case "polling":
      return "Waiting for BLS signature…";
    case "catchup":
      return "Syncing bridge epoch…";
    case "withdrawing":
      return "Confirm release in MetaMask…";
    default:
      return `Withdraw ${sym}`;
  }
}

function WithdrawProgress({
  status,
  note,
  gonkaTxHash,
  ethereumTxHash,
  error,
  amount,
  symbol,
  onDone,
}: {
  status: WithdrawStatus;
  note: string | null;
  gonkaTxHash: string | null;
  ethereumTxHash: string | null;
  error: string | null;
  amount: string | null;
  symbol: string;
  onDone: () => void;
}) {
  if (status === "idle") return null;

  return (
    <div className="wd-progress">
      <ol className="wd-steps">
        <Step label="Burn on Gonka" done={!!gonkaTxHash} active={status === "burning"} />
        <Step
          label="BLS signature"
          done={status === "withdrawing" || status === "success"}
          active={status === "polling" || status === "catchup"}
        />
        <Step label="Release on Sepolia" done={status === "success"} active={status === "withdrawing"} />
      </ol>

      {note && status !== "success" && status !== "error" && (
        <p className="wd-note">
          <Pill tone="accent">{note}</Pill>
        </p>
      )}

      {gonkaTxHash && (
        <span className="wd-txlink mono" title="Gonka burn tx">
          burn: {truncate(gonkaTxHash, 8, 6)}
        </span>
      )}
      {ethereumTxHash && (
        <a
          className="wd-txlink mono"
          href={`${SEPOLIA.explorer}/tx/${ethereumTxHash}`}
          target="_blank"
          rel="noreferrer"
        >
          release: {truncate(ethereumTxHash, 8, 6)} ↗
        </a>
      )}

      {status === "success" && (
        <div className="wd-done">
          <Pill tone="ok">released</Pill>
          <span>
            <span className="mono">{amount}</span> {symbol} sent to your Sepolia address
          </span>
          <Button size="sm" variant="ghost" onClick={onDone}>
            New withdrawal
          </Button>
        </div>
      )}
      {status === "error" && (
        <div className="wd-err">
          <p>{error}</p>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function Step({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <li className={`wd-step${done ? " wd-step--done" : ""}${active ? " wd-step--active" : ""}`}>
      <span className="wd-step__dot" />
      {label}
    </li>
  );
}
