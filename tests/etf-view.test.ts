import { describe, expect, it } from "vitest";
import { etfs } from "@/data/etfs";
import { groupByWeighting, isEqualWeight, terBarShare, terScaleMax } from "@/lib/etf-view";

describe("TER bar scale", () => {
  it("ends at the highest stored expense ratio and starts at zero", () => {
    const max = terScaleMax(etfs);
    expect(max).toBe(Math.max(...etfs.map((etf) => etf.expenseRatioPercentPerYear.value)));
    expect(terBarShare(max, max)).toBe(1);
    expect(terBarShare(0, max)).toBe(0);
  });

  it("is linear, so bar lengths keep the ratio between expense ratios", () => {
    expect(terBarShare(0.02, 0.2)).toBeCloseTo(0.1);
    expect(terBarShare(0.0945, 0.2)).toBeCloseTo(0.4725);
  });

  it("never returns a width outside 0 to 1", () => {
    expect(terBarShare(0.3, 0.2)).toBe(1);
    expect(terBarShare(0.1, 0)).toBe(0);
  });
});

describe("groupByWeighting", () => {
  it("keeps equal-weight funds out of the market-cap-weighted group", () => {
    const groups = groupByWeighting(etfs);
    expect(groups.map((group) => group.weighting)).toEqual(["float-adjusted-market-cap", "equal"]);
    expect(groups[0].funds.some(isEqualWeight)).toBe(false);
    expect(groups[1].funds.every(isEqualWeight)).toBe(true);
    expect(groups.flatMap((group) => group.funds)).toHaveLength(etfs.length);
  });
});
