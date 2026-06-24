import type { ReactNode } from "react";
import "./ui.css";

type Tone = "ok" | "bad" | "warn" | "accent" | "neutral";

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const cls = tone === "neutral" ? "pill" : `pill pill--${tone}`;
  return (
    <span className={cls}>
      <span className="pill__dot" />
      {children}
    </span>
  );
}
