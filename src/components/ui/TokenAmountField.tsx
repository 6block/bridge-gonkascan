import type { BridgeToken } from "@/config/chains";
import { formatUnits } from "@/lib/format";
import "./ui.css";

interface Props {
  tokens: BridgeToken[];
  token: BridgeToken;
  onTokenChange: (symbol: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  balance: bigint | null;
  balanceLabel?: string;
  disabled?: boolean;
}

export function TokenAmountField({
  tokens,
  token,
  onTokenChange,
  amount,
  onAmountChange,
  balance,
  balanceLabel = "Balance",
  disabled,
}: Props) {
  const setMax = () => {
    if (balance !== null) onAmountChange(formatUnits(balance, token.decimals));
  };

  return (
    <div className={`taf${disabled ? " taf--disabled" : ""}`}>
      <div className="taf__row">
        <input
          className="taf__input mono"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          disabled={disabled}
          onChange={(e) => onAmountChange(e.target.value)}
        />
        <select
          className="taf__select"
          value={token.symbol}
          disabled={disabled}
          onChange={(e) => onTokenChange(e.target.value)}
        >
          {tokens.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
      <div className="taf__meta">
        <span className="taf__bal">
          {balanceLabel}:{" "}
          <span className="mono">
            {balance === null ? "—" : formatUnits(balance, token.decimals)}
          </span>
        </span>
        <button type="button" className="taf__max" onClick={setMax} disabled={disabled || balance === null}>
          MAX
        </button>
      </div>
    </div>
  );
}
