// Czech number, currency and date formatting, plus parsing of typed numbers.

const NBSP = " ";

const expenseRatioFormat = new Intl.NumberFormat("cs-CZ", {
  minimumFractionDigits: 2,
  // Four decimals keep 0.0945 % distinct from 0.09 % and 0.10 %.
  maximumFractionDigits: 4,
});

const integerFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

/** Formats a percentage value that is already in percent: 0.0945 -> "0,0945 %". */
export function formatPercent(valueInPercent: number): string {
  return `${expenseRatioFormat.format(valueInPercent)}${NBSP}%`;
}

/** Whole Czech crowns: 1234567.8 -> "1 234 568 Kč". */
export function formatCzk(amount: number): string {
  return `${integerFormat.format(Math.round(amount))}${NBSP}Kč`;
}

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

/** ISO date to Czech notation without time-zone shifts: "2026-10-11" -> "11. 10. 2026". */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day}.${NBSP}${month}.${NBSP}${year}`;
}

/**
 * Parses a number typed by a Czech user. Accepts a decimal comma or point and
 * spaces as thousands separators. Returns NaN for anything else, so invalid
 * input is never silently coerced.
 */
export function parseDecimalInput(raw: string): number {
  const compact = raw.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(compact)) return Number.NaN;
  return Number(compact);
}
