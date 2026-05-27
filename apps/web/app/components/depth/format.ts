export function formatPrice(value: string | number): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAmount(value: string | number): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  if (parsed === 0) return "0";
  const abs = Math.abs(parsed);
  const maxFractionDigits = abs < 0.0001 ? 6 : abs < 1 ? 4 : abs < 100 ? 3 : 2;
  return parsed.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function splitMarket(market: string) {
  const [base = "", quote = "USDC"] = market.split("_");
  return { base, quote };
}
