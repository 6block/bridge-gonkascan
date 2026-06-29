import { useEffect, useId, useRef, useState } from "react";
import type { BridgeToken } from "@/config/chains";

interface Props {
  tokens: BridgeToken[];
  token: BridgeToken;
  onTokenChange: (symbol: string) => void;
  disabled?: boolean;
}

/**
 * Custom token picker — replaces the native <select> whose chrome can't be
 * styled to match the dark-luxury surface. Renders a pill trigger plus a
 * popover menu; fully keyboard- and click-outside-aware.
 */
export function TokenSelect({ tokens, token, onTokenChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (symbol: string) => {
    if (symbol !== token.symbol) onTokenChange(symbol);
    setOpen(false);
  };

  return (
    <div className="tsel" ref={rootRef}>
      <button
        type="button"
        className={`tsel__trigger${open ? " tsel__trigger--open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <TokenGlyph symbol={token.symbol} />
        <span className="tsel__sym">{token.symbol}</span>
        <svg className="tsel__chev" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="tsel__menu" id={listId} role="listbox">
          {tokens.map((t) => {
            const active = t.symbol === token.symbol;
            return (
              <li key={t.symbol} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`tsel__opt${active ? " tsel__opt--active" : ""}`}
                  onClick={() => select(t.symbol)}
                >
                  <TokenGlyph symbol={t.symbol} />
                  <span className="tsel__opt-text">
                    <span className="tsel__opt-sym">{t.symbol}</span>
                    <span className="tsel__opt-name">{t.name}</span>
                  </span>
                  {active && (
                    <svg className="tsel__check" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M3 7.5L6 10.5L11.5 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Small colored monogram so each token reads distinctly at a glance. */
function TokenGlyph({ symbol }: { symbol: string }) {
  return (
    <span className={`tsel__glyph tsel__glyph--${symbol.toLowerCase()}`} aria-hidden="true">
      {symbol.charAt(0)}
    </span>
  );
}
