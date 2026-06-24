/** Shorten an address for display: 0x1234…ab12 / gonka1abc…wxyz. */
export function truncate(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Format a base-unit integer amount into a human decimal string. */
export function formatUnits(base: bigint | string, decimals: number): string {
  const v = typeof base === "bigint" ? base : BigInt(base || "0");
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const d = BigInt(10) ** BigInt(decimals);
  const whole = abs / d;
  const frac = abs % d;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const out = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${out}` : out;
}

/** Parse a human decimal string into a base-unit integer. Throws on bad input. */
export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error(`Invalid amount: "${value}"`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Too many decimals: max ${decimals}`);
  }
  const padded = frac.padEnd(decimals, "0");
  return BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0");
}
