import { describe, expect, it } from "vitest";
import { etfs, expenseRatioFraction, getEtf } from "@/data/etfs";
import {
  INPUT_LIMITS,
  calculateFeeImpact,
  futureValue,
  monthlyNetRate,
  validateInputs,
  type CalculationOutcome,
  type CalculatorInputs,
  type FeeImpact,
} from "@/lib/calculator";
import { strategiesDiffer, toCalculatorFund } from "@/lib/etf-view";

const base: CalculatorInputs = {
  initialDeposit: 100_000,
  monthlyContribution: 3_000,
  years: 20,
  annualReturnPct: 6,
};

function expectResult(outcome: CalculationOutcome): FeeImpact {
  if (!outcome.ok) throw new Error(`expected a result, got ${JSON.stringify(outcome.issues)}`);
  return outcome.result;
}

function issueCodes(outcome: CalculationOutcome): string[] {
  return outcome.ok ? [] : outcome.issues.map((issue) => `${issue.field}:${issue.code}`);
}

describe("hand-checkable cases", () => {
  it("grows a lump sum by the net annual rate over one year", () => {
    // 1 000 at 10 % minus 1 % TER for one year: 1 000 * 1.09 = 1 090.
    const result = expectResult(
      calculateFeeImpact(
        { initialDeposit: 1_000, monthlyContribution: 0, years: 1, annualReturnPct: 10 },
        0.01,
      ),
    );
    expect(result.finalValue).toBeCloseTo(1_090, 8);
    expect(result.zeroTerValue).toBeCloseTo(1_100, 8);
    expect(result.feeCost).toBeCloseTo(10, 8);
    expect(result.months).toBe(12);
    expect(result.totalContributions).toBe(1_000);
  });

  it("matches the annuity formula for end-of-month contributions at 1 % a month", () => {
    // Twelve payments of 100 at i = 1 %: 100 * (1.01^12 - 1) / 0.01 = 1 268.2503.
    expect(futureValue(0, 100, 12, 0.01)).toBeCloseTo(1_268.2503, 4);
  });

  it("does not let the final contribution earn any growth", () => {
    // A single month: the contribution arrives at month end, so it is worth 100.
    expect(futureValue(0, 100, 1, 0.05)).toBeCloseTo(100, 10);
  });

  it("derives the monthly rate so that twelve months compound to the annual net rate", () => {
    const monthly = monthlyNetRate(0.07, 0.002);
    expect((1 + monthly) ** 12).toBeCloseTo(1.068, 12);
  });
});

describe("zero expense ratio", () => {
  it("makes the final value equal the zero-TER baseline, with no fee cost", () => {
    const result = expectResult(calculateFeeImpact(base, 0));
    expect(result.finalValue).toBe(result.zeroTerValue);
    expect(result.feeCost).toBe(0);
  });
});

describe("zero or near-zero monthly growth", () => {
  it("returns deposits plus contributions when return and TER cancel out", () => {
    const result = expectResult(
      calculateFeeImpact(
        { initialDeposit: 5_000, monthlyContribution: 200, years: 10, annualReturnPct: 0.2 },
        0.002,
      ),
    );
    expect(result.finalValue).toBeCloseTo(5_000 + 200 * 120, 6);
  });

  it("uses the limit instead of dividing by zero", () => {
    expect(futureValue(1_000, 100, 24, 0)).toBe(3_400);
    expect(futureValue(1_000, 100, 24, 1e-13)).toBe(3_400);
  });

  it("stays continuous just above the zero-rate threshold", () => {
    const value = futureValue(1_000, 100, 24, 1e-9);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeCloseTo(3_400, 3);
  });

  it("handles a negative assumed return without producing invalid numbers", () => {
    const result = expectResult(calculateFeeImpact({ ...base, annualReturnPct: -5 }, 0.002));
    expect(Number.isFinite(result.finalValue)).toBe(true);
    expect(result.finalValue).toBeLessThan(result.totalContributions);
    expect(result.feeCost).toBeGreaterThan(0);
  });
});

describe("deposit and contribution combinations", () => {
  it("handles an initial deposit with no monthly contributions", () => {
    const result = expectResult(
      calculateFeeImpact({ ...base, monthlyContribution: 0, years: 2, annualReturnPct: 10 }, 0),
    );
    expect(result.finalValue).toBeCloseTo(100_000 * 1.1 ** 2, 6);
    expect(result.totalContributions).toBe(100_000);
  });

  it("handles monthly contributions with no initial deposit", () => {
    const result = expectResult(
      calculateFeeImpact({ ...base, initialDeposit: 0, years: 1, annualReturnPct: 0 }, 0),
    );
    expect(result.finalValue).toBe(36_000);
    expect(result.totalContributions).toBe(36_000);
  });

  it("adds the two components independently", () => {
    const both = expectResult(calculateFeeImpact(base, 0.001));
    const depositOnly = expectResult(calculateFeeImpact({ ...base, monthlyContribution: 0 }, 0.001));
    const contributionsOnly = expectResult(
      calculateFeeImpact({ ...base, initialDeposit: 0 }, 0.001),
    );
    expect(both.finalValue).toBeCloseTo(depositOnly.finalValue + contributionsOnly.finalValue, 6);
  });
});

describe("effect of the expense ratio", () => {
  it("produces a larger fee cost for a higher TER under identical assumptions", () => {
    const ratios = [0.0002, 0.0003, 0.000945, 0.002, 0.01];
    const costs = ratios.map((ratio) => expectResult(calculateFeeImpact(base, ratio)).feeCost);
    for (let index = 1; index < costs.length; index += 1) {
      expect(costs[index]).toBeGreaterThan(costs[index - 1]);
    }
  });

  it("keeps the zero-TER baseline independent of the fund's TER", () => {
    const low = expectResult(calculateFeeImpact(base, 0.0002));
    const high = expectResult(calculateFeeImpact(base, 0.002));
    expect(low.zeroTerValue).toBe(high.zeroTerValue);
  });
});

describe("expense ratio units from the ETF data", () => {
  it("converts every stored percentage to one hundredth as a fraction", () => {
    for (const etf of etfs) {
      const fund = toCalculatorFund(etf);
      expect(fund.expenseRatioPct).toBe(etf.expenseRatioPercentPerYear.value);
      expect(fund.expenseRatio).toBeCloseTo(fund.expenseRatioPct / 100, 12);
      expect(fund.expenseRatio).toBe(expenseRatioFraction(etf));
    }
  });

  it("treats a stored 0.02 as 0.02 % per year, not 2 %", () => {
    const stored = etfs.find((etf) => etf.expenseRatioPercentPerYear.value === 0.02);
    expect(stored).toBeDefined();
    const oneYear: CalculatorInputs = {
      initialDeposit: 1_000_000,
      monthlyContribution: 0,
      years: 1,
      annualReturnPct: 0,
    };
    const result = expectResult(calculateFeeImpact(oneYear, toCalculatorFund(stored!).expenseRatio));
    // 0.02 % of 1 000 000 is 200. Read as 2 % it would be 20 000.
    expect(result.feeCost).toBeCloseTo(200, 6);
  });
});

describe("invalid and unsafe inputs", () => {
  it("accepts the default-style scenario", () => {
    expect(validateInputs(base)).toEqual([]);
  });

  it.each([
    ["NaN deposit", { initialDeposit: Number.NaN }, "initialDeposit:invalid-number"],
    ["infinite contribution", { monthlyContribution: Infinity }, "monthlyContribution:invalid-number"],
    ["negative deposit", { initialDeposit: -1 }, "initialDeposit:too-low"],
    ["negative contribution", { monthlyContribution: -50 }, "monthlyContribution:too-low"],
    ["zero horizon", { years: 0 }, "years:too-low"],
    ["negative horizon", { years: -5 }, "years:too-low"],
    ["fractional horizon", { years: 2.5 }, "years:not-integer"],
    ["horizon above the limit", { years: INPUT_LIMITS.years.max + 1 }, "years:too-high"],
    ["return of -100 %", { annualReturnPct: -100 }, "annualReturnPct:too-low"],
    ["absurd return", { annualReturnPct: 1_000 }, "annualReturnPct:too-high"],
    ["deposit above the limit", { initialDeposit: 1e12 }, "initialDeposit:too-high"],
  ] as const)("rejects %s", (_name, override, expected) => {
    const outcome = calculateFeeImpact({ ...base, ...override }, 0.0003);
    expect(outcome.ok).toBe(false);
    expect(issueCodes(outcome)).toContain(expected);
  });

  it("rejects a scenario with nothing invested", () => {
    const outcome = calculateFeeImpact({ ...base, initialDeposit: 0, monthlyContribution: 0 }, 0.0003);
    expect(issueCodes(outcome)).toEqual(["form:no-investment"]);
  });

  it.each([
    ["NaN", Number.NaN, "expenseRatio:invalid-number"],
    ["negative", -0.001, "expenseRatio:too-low"],
    ["100 % or more", 1, "expenseRatio:too-high"],
  ])("rejects a %s expense ratio", (_name, ratio, expected) => {
    expect(issueCodes(calculateFeeImpact(base, ratio))).toContain(expected);
  });

  it("rejects a return and TER that leave no positive growth base", () => {
    const outcome = calculateFeeImpact({ ...base, annualReturnPct: -20 }, 0.9);
    expect(issueCodes(outcome)).toEqual(["form:unsafe-rate"]);
    expect(Number.isNaN(monthlyNetRate(-0.2, 0.9))).toBe(true);
  });

  it("returns only finite numbers at the extreme allowed bounds", () => {
    const result = expectResult(
      calculateFeeImpact(
        {
          initialDeposit: INPUT_LIMITS.initialDeposit.max,
          monthlyContribution: INPUT_LIMITS.monthlyContribution.max,
          years: INPUT_LIMITS.years.max,
          annualReturnPct: INPUT_LIMITS.annualReturnPct.max,
        },
        0.002,
      ),
    );
    for (const value of Object.values(result)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(Number.isSafeInteger(Math.round(result.zeroTerValue))).toBe(true);
  });
});

describe("funds with different index strategies", () => {
  const equalWeight = etfs.find((etf) => etf.indexWeighting.value === "equal");
  const marketCap = etfs.find((etf) => etf.indexWeighting.value === "float-adjusted-market-cap");

  it("has one fund of each strategy to compare", () => {
    expect(equalWeight).toBeDefined();
    expect(marketCap).toBeDefined();
  });

  it("applies the same formula regardless of strategy: only the TER matters", () => {
    const fund = toCalculatorFund(equalWeight!);
    const viaFund = expectResult(calculateFeeImpact(base, fund.expenseRatio));
    const viaPlainNumber = expectResult(
      calculateFeeImpact(base, equalWeight!.expenseRatioPercentPerYear.value / 100),
    );
    expect(viaFund).toEqual(viaPlainNumber);
  });

  it("flags the pair as different strategies instead of treating them as equivalent", () => {
    const pair = [toCalculatorFund(equalWeight!), toCalculatorFund(marketCap!)];
    expect(strategiesDiffer(pair)).toBe(true);
  });

  it("does not flag two funds that share a weighting method", () => {
    const sameStrategy = etfs
      .filter((etf) => etf.indexWeighting.value === "float-adjusted-market-cap")
      .slice(0, 2)
      .map(toCalculatorFund);
    expect(sameStrategy).toHaveLength(2);
    expect(strategiesDiffer(sameStrategy)).toBe(false);
  });

  it("exposes no real-world return in the result, only modelled values", () => {
    const result = expectResult(calculateFeeImpact(base, toCalculatorFund(getEtf("RSP")!).expenseRatio));
    expect(Object.keys(result).sort()).toEqual(
      ["feeCost", "finalValue", "months", "totalContributions", "zeroTerValue"].sort(),
    );
  });
});
