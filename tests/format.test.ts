import { describe, expect, it } from "vitest";
import { etfs } from "@/data/etfs";
import { snapshotDate } from "@/lib/etf-view";
import {
  czechPlural,
  formatCzk,
  formatDate,
  formatPercent,
  formatShare,
  parseDecimalInput,
} from "@/lib/format";

// Intl uses non-breaking spaces; compare against plain spaces for readability.
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("formatPercent", () => {
  it("uses a decimal comma and keeps four decimals where they carry meaning", () => {
    expect(plain(formatPercent(0.0945))).toBe("0,0945 %");
  });

  it("keeps at least two decimals", () => {
    expect(plain(formatPercent(0.02))).toBe("0,02 %");
    expect(plain(formatPercent(0.2))).toBe("0,20 %");
  });

  it("never renders two different stored expense ratios identically", () => {
    const values = [...new Set(etfs.map((etf) => etf.expenseRatioPercentPerYear.value))];
    const rendered = new Set(values.map(formatPercent));
    expect(rendered.size).toBe(values.length);
  });

  it("does not turn a stored percentage into a hundred times larger figure", () => {
    for (const etf of etfs) {
      const text = plain(formatPercent(etf.expenseRatioPercentPerYear.value));
      expect(parseDecimalInput(text.replace(" %", ""))).toBe(etf.expenseRatioPercentPerYear.value);
    }
  });
});

describe("formatCzk", () => {
  it("rounds to whole crowns with Czech thousands separators", () => {
    expect(plain(formatCzk(1_234_567.8))).toBe("1 234 568 Kč");
    expect(plain(formatCzk(0))).toBe("0 Kč");
  });
});

describe("formatShare", () => {
  it("rounds a computed share to two decimals", () => {
    expect(plain(formatShare(0.58341))).toBe("0,58 %");
    expect(plain(formatShare(0))).toBe("0,00 %");
  });
});

describe("czechPlural", () => {
  it("picks the Czech form for one, two to four and five or more", () => {
    const form = (count: number) => czechPlural(count, "zdroj", "zdroje", "zdrojů");
    expect([0, 1, 2, 4, 5, 11].map(form)).toEqual([
      "zdrojů",
      "zdroj",
      "zdroje",
      "zdroje",
      "zdrojů",
      "zdrojů",
    ]);
  });
});

describe("formatDate", () => {
  it("renders an ISO date in Czech order without shifting the day", () => {
    expect(plain(formatDate("2026-10-11"))).toBe("11. 10. 2026");
    expect(plain(formatDate("2003-04-24"))).toBe("24. 4. 2003");
  });
});

describe("parseDecimalInput", () => {
  it.each([
    ["1500", 1500],
    ["6,5", 6.5],
    ["6.5", 6.5],
    ["100 000", 100000],
    ["100 000", 100000],
    [" 20 ", 20],
    ["-5", -5],
    ["0", 0],
  ])("parses %j", (raw, expected) => {
    expect(parseDecimalInput(raw)).toBe(expected);
  });

  it.each(["", " ", "abc", "12abc", "1e5", "1,2,3", "5,", ",5", "--5", "Infinity", "NaN"])(
    "returns NaN for %j instead of guessing",
    (raw) => {
      expect(Number.isNaN(parseDecimalInput(raw))).toBe(true);
    },
  );
});

describe("snapshotDate", () => {
  it("is the latest retrieval date found in the data", () => {
    const all = etfs.flatMap((etf) => etf.sources.map((source) => source.retrievedOn));
    const snapshot = snapshotDate(etfs);
    expect(all).toContain(snapshot);
    expect(all.every((date) => date <= snapshot)).toBe(true);
  });
});
