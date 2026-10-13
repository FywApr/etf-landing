// Fee-impact model for the calculator. Pure functions only, no React.
//
// The model assumes a constant annual return before fund expenses and monthly
// compounding, with contributions made at the end of each month. It estimates
// how a fund's expense ratio changes the final value; it is not a ledger of
// fees actually paid and says nothing about what a fund will really return.

export interface CalculatorInputs {
  initialDeposit: number;
  monthlyContribution: number;
  years: number;
  /** Assumed annual return before fund expenses, in percent: 7 means 7 %. */
  annualReturnPct: number;
}

export type InputField = keyof CalculatorInputs;

export const INPUT_LIMITS = {
  initialDeposit: { min: 0, max: 100_000_000 },
  monthlyContribution: { min: 0, max: 1_000_000 },
  years: { min: 1, max: 60 },
  annualReturnPct: { min: -20, max: 30 },
} as const satisfies Record<InputField, { min: number; max: number }>;

export type IssueCode =
  | "invalid-number"
  | "too-low"
  | "too-high"
  | "not-integer"
  // Both the deposit and the monthly contribution are zero.
  | "no-investment"
  // The return and expense ratio combine into a non-positive growth base.
  | "unsafe-rate";

export interface ValidationIssue {
  field: InputField | "expenseRatio" | "form";
  code: IssueCode;
}

export interface FeeImpact {
  months: number;
  totalContributions: number;
  /** Estimated final value after the fund's modelled expenses. */
  finalValue: number;
  /** Final value under the same assumptions with a zero expense ratio. */
  zeroTerValue: number;
  /** zeroTerValue - finalValue. */
  feeCost: number;
}

export type CalculationOutcome =
  | { ok: true; result: FeeImpact }
  | { ok: false; issues: ValidationIssue[] };

// Below this monthly rate the annuity formula divides by ~0, so use its limit.
const ZERO_RATE_EPSILON = 1e-10;

export function validateInputs(inputs: CalculatorInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of Object.keys(INPUT_LIMITS) as InputField[]) {
    const value = inputs[field];
    const { min, max } = INPUT_LIMITS[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ field, code: "invalid-number" });
    } else if (value < min) {
      issues.push({ field, code: "too-low" });
    } else if (value > max) {
      issues.push({ field, code: "too-high" });
    } else if (field === "years" && !Number.isInteger(value)) {
      issues.push({ field, code: "not-integer" });
    }
  }

  if (issues.length === 0 && inputs.initialDeposit === 0 && inputs.monthlyContribution === 0) {
    issues.push({ field: "form", code: "no-investment" });
  }

  return issues;
}

/**
 * Monthly growth rate after expenses: i = (1 + r - TER)^(1/12) - 1.
 * Both arguments are decimal fractions (0.07 for 7 %). Returns NaN when the
 * growth base is not positive.
 */
export function monthlyNetRate(annualReturn: number, expenseRatio: number): number {
  const base = 1 + annualReturn - expenseRatio;
  if (!(base > 0)) return Number.NaN;
  return Math.expm1(Math.log(base) / 12);
}

/**
 * Future value of a deposit plus end-of-month contributions:
 * FV = P(1+i)^n + C((1+i)^n - 1)/i, or P + C·n when i is effectively zero.
 */
export function futureValue(
  initialDeposit: number,
  monthlyContribution: number,
  months: number,
  monthlyRate: number,
): number {
  if (Math.abs(monthlyRate) < ZERO_RATE_EPSILON) {
    return initialDeposit + monthlyContribution * months;
  }
  const logGrowth = months * Math.log1p(monthlyRate);
  return (
    initialDeposit * Math.exp(logGrowth) +
    (monthlyContribution * Math.expm1(logGrowth)) / monthlyRate
  );
}

/**
 * Estimates the effect of an expense ratio on the final value.
 * `expenseRatio` is a decimal fraction per year (0.0003 for 0.03 %); obtain it
 * from `expenseRatioFraction()` in data/etfs.ts rather than converting by hand.
 */
export function calculateFeeImpact(
  inputs: CalculatorInputs,
  expenseRatio: number,
): CalculationOutcome {
  const issues = validateInputs(inputs);

  if (typeof expenseRatio !== "number" || !Number.isFinite(expenseRatio)) {
    issues.push({ field: "expenseRatio", code: "invalid-number" });
  } else if (expenseRatio < 0) {
    issues.push({ field: "expenseRatio", code: "too-low" });
  } else if (expenseRatio >= 1) {
    issues.push({ field: "expenseRatio", code: "too-high" });
  }
  if (issues.length > 0) return { ok: false, issues };

  const annualReturn = inputs.annualReturnPct / 100;
  const months = inputs.years * 12;
  const netRate = monthlyNetRate(annualReturn, expenseRatio);
  const grossRate = monthlyNetRate(annualReturn, 0);
  if (!Number.isFinite(netRate) || !Number.isFinite(grossRate)) {
    return { ok: false, issues: [{ field: "form", code: "unsafe-rate" }] };
  }

  const finalValue = futureValue(inputs.initialDeposit, inputs.monthlyContribution, months, netRate);
  const zeroTerValue = futureValue(
    inputs.initialDeposit,
    inputs.monthlyContribution,
    months,
    grossRate,
  );
  if (!Number.isFinite(finalValue) || !Number.isFinite(zeroTerValue)) {
    return { ok: false, issues: [{ field: "form", code: "unsafe-rate" }] };
  }

  return {
    ok: true,
    result: {
      months,
      totalContributions: inputs.initialDeposit + inputs.monthlyContribution * months,
      finalValue,
      zeroTerValue,
      feeCost: zeroTerValue - finalValue,
    },
  };
}
