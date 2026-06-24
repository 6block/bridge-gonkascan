import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

type Variant = "primary" | "default" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  children: ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  children,
  className,
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
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
