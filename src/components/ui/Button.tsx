import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

type Variant = "primary" | "default" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    variant === "primary" ? "btn--primary" : variant === "ghost" ? "btn--ghost" : "",
    size === "sm" ? "btn--sm" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="btn__spinner" aria-hidden />}
      {children}
    </button>
  );
}
