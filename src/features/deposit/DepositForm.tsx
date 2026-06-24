import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TokenAmountField } from "@/components/ui/TokenAmountField";
import { SEPOLIA, TOKENS, tokenBySymbol } from "@/config/chains";
import { formatUnits, parseUnits, truncate } from "@/lib/format";
import { useWallet } from "@/features/wallet/WalletContext";
import { useBalances } from "./useBalances";
import { useDeposit } from "./useDeposit";
import "./deposit.css";

const BUSY: ReadonlySet<string> = new Set(["submitting", "pending", "crediting"]);

export function DepositForm() {
  const { evm, gonka, guard } = useWallet();
  const [symbol, setSymbol] = useState(TOKENS[0].symbol);
  const [amount, setAmount] = useState("");
  const token = tokenBySymbol(symbol) ?? TOKENS[0];

  const balances = useBalances(token, evm?.address ?? null, gonka?.address ?? null);
  const { status, txHash, credited, error, deposit, reset } = useDeposit(
    token,
    evm?.provider ?? null,
    gonka?.address ?? null,
  );

  const { parsed, parseError } = useMemo(() => {
    if (!amount.trim()) return { parsed: null, parseError: null };
    try {
      return { parsed: parseUnits(amount, token.decimals), parseError: null };
    } catch (e) {
      return { parsed: null, parseError: e instanceof Error ? e.message : "Invalid amount" };
    }
  }, [amount, token.decimals]);

  const busy = BUSY.has(status);
  const overBalance = parsed !== null && balances.erc20 !== null && parsed > balances.erc20;
  const ready = Boolean(evm && gonka && guard?.match);
  const canDeposit = ready && parsed !== null && parsed > 0n && !overBalance && !busy;

  const blocker = !evm
    ? "Connect MetaMask to deposit"
    : !gonka
      ? "Connect Keplr to set your Gonka recipient"
      : !guard?.match
        ? "Address mismatch — resolve the warning above"
        : null;

  return (
    <div className="deposit">
      <TokenAmountField
        tokens={TOKENS}
        token={token}
        onTokenChange={setSymbol}
        amount={amount}
        onAmountChange={setAmount}
        balance={balances.erc20}
        balanceLabel="Sepolia balance"
        disabled={busy}
      />

      <div className="deposit__route">
        <span className="deposit__route-leg">
          <span className="deposit__chain">Sepolia</span>
          <span className="deposit__sub">{token.symbol}</span>
        </span>
        <span className="deposit__arrow">→</span>
        <span className="deposit__route-leg deposit__route-leg--to">
          <span className="deposit__chain">Gonka</span>
          <span className="deposit__sub">
            {gonka ? truncate(gonka.address, 8, 6) : "connect Keplr"}
          </span>
        </span>
      </div>

      {parseError && <p className="deposit__warn">{parseError}</p>}
      {overBalance && <p className="deposit__warn">Amount exceeds your Sepolia balance.</p>}

      {blocker ? (
        <Button variant="ghost" disabled>
          {blocker}
        </Button>
      ) : (
        <Button
          variant="primary"
          disabled={!canDeposit}
          onClick={() => parsed && deposit(parsed)}
        >
          {statusLabel(status, token.symbol)}
        </Button>
      )}

      <DepositProgress
        status={status}
        txHash={txHash}
        credited={credited === null ? null : formatUnits(credited, token.decimals)}
        symbol={token.symbol}
        error={error}
        gonkaBalance={
          balances.cw20 === null ? null : formatUnits(balances.cw20, token.decimals)
        }
        onDone={() => {
          setAmount("");
          balances.refresh();
          reset();
        }}
      />
    </div>
  );
}

function statusLabel(status: string, sym: string): string {
  switch (status) {
    case "submitting":
      return "Confirm in MetaMask…";
    case "pending":
      return "Transferring on Sepolia…";
    case "crediting":
      return "Waiting for Gonka credit…";
    default:
      return `Deposit ${sym}`;
  }
}

function DepositProgress({
  status,
  txHash,
  credited,
  symbol,
  error,
  gonkaBalance,
  onDone,
}: {
  status: string;
  txHash: string | null;
  credited: string | null;
  symbol: string;
  error: string | null;
  gonkaBalance: string | null;
  onDone: () => void;
}) {
  if (status === "idle") {
    return gonkaBalance !== null ? (
      <p className="deposit__hint">
        Current Gonka balance: <span className="mono">{gonkaBalance}</span> {symbol}
      </p>
    ) : null;
  }

  return (
    <div className="deposit__progress">
      {txHash && (
        <a
          className="deposit__txlink mono"
          href={`${SEPOLIA.explorer}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {truncate(txHash, 10, 8)} ↗
        </a>
      )}
      {status === "crediting" && (
        <span className="deposit__crediting">
          <Pill tone="accent">validators minting…</Pill>
        </span>
      )}
      {status === "success" && (
        <div className="deposit__done">
          <Pill tone="ok">credited</Pill>
          <span>
            +<span className="mono">{credited}</span> {symbol} on Gonka
          </span>
          <Button size="sm" variant="ghost" onClick={onDone}>
            New deposit
          </Button>
        </div>
      )}
      {status === "slow" && (
        <div className="deposit__slow">
          <Pill tone="warn">still settling</Pill>
          <p>{error}</p>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Check balance
          </Button>
        </div>
      )}
      {status === "error" && (
        <div className="deposit__err">
          <p>{error}</p>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
