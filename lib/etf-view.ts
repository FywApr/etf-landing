// Czech labels for ETF data enums and small view helpers derived from
// data/etfs.ts. No financial values live here.

import {
  expenseRatioFraction,
  type DistributionFrequency,
  type DomicileCountry,
  type Etf,
  type IndexWeighting,
  type IsoDate,
  type SourceKind,
} from "@/data/etfs";

export const UNVERIFIED_LABEL = "Neověřeno";

/** Shown wherever an equal-weight fund appears next to market-cap-weighted ones. */
export const EQUAL_WEIGHT_LABEL = "Rovnoměrně vážený index — odlišná strategie";

export const weightingLabels: Record<IndexWeighting, string> = {
  "float-adjusted-market-cap": "Vážený tržní kapitalizací",
  equal: "Rovnoměrně vážený",
};

export const domicileLabels: Record<DomicileCountry, string> = {
  US: "USA",
};

export const distributionLabels: Record<DistributionFrequency, string> = {
  quarterly: "Čtvrtletně",
};

export const sourceKindLabels: Record<SourceKind, string> = {
  "issuer-product-page": "Stránka fondu u správce",
  "issuer-fact-sheet": "Přehled fondu (fact sheet)",
  "issuer-prospectus": "Prospekt",
  "issuer-sec-filing": "Souhrnný prospekt podaný u SEC",
};

/**
 * Czech wording of the caveat recorded in a fund's `inceptionDate.note`,
 * keyed by ticker. Update together with the note in data/etfs.ts.
 */
export const inceptionNotes: Partial<Record<string, string>> = {
  RSP: "Podle něj je výkonnost do 6.\u00a04.\u00a02018 výkonností předchozího fondu.",
};

export function isEqualWeight(etf: Etf): boolean {
  return etf.indexWeighting.value === "equal";
}

/** Latest retrieval date across all funds: the date of the data snapshot. */
export function snapshotDate(funds: Etf[]): IsoDate {
  return funds
    .flatMap((etf) => etf.sources.map((source) => source.retrievedOn))
    .sort()
    .at(-1)!;
}

/** The minimal, serialisable fund shape the calculator needs on the client. */
export interface CalculatorFund {
  ticker: string;
  name: string;
  /** Percent per year, for display. */
  expenseRatioPct: number;
  /** Decimal fraction per year, for the calculation. */
  expenseRatio: number;
  weighting: IndexWeighting;
}

export function toCalculatorFund(etf: Etf): CalculatorFund {
  return {
    ticker: etf.ticker,
    name: etf.name.value,
    expenseRatioPct: etf.expenseRatioPercentPerYear.value,
    expenseRatio: expenseRatioFraction(etf),
    weighting: etf.indexWeighting.value,
  };
}

/** True when the funds do not all share one index weighting method. */
export function strategiesDiffer(funds: Pick<CalculatorFund, "weighting">[]): boolean {
  return new Set(funds.map((fund) => fund.weighting)).size > 1;
}

/** Highest expense ratio in percent: the end of the linear scale for TER bars. */
export function terScaleMax(funds: Etf[]): number {
  return Math.max(...funds.map((etf) => etf.expenseRatioPercentPerYear.value));
}

/** Width of a TER bar as a share of the scale, 0 to 1. The scale starts at zero. */
export function terBarShare(expenseRatioPct: number, scaleMax: number): number {
  return scaleMax > 0 ? Math.min(expenseRatioPct / scaleMax, 1) : 0;
}

export interface WeightingGroup {
  weighting: IndexWeighting;
  funds: Etf[];
}

/**
 * Splits funds by index weighting, market-cap-weighted first, keeping the
 * data order inside each group. Equal-weight funds are never mixed into the
 * same group as the market-cap-weighted ones.
 */
export function groupByWeighting(funds: Etf[]): WeightingGroup[] {
  const order: IndexWeighting[] = ["float-adjusted-market-cap", "equal"];
  return order
    .map((weighting) => ({
      weighting,
      funds: funds.filter((etf) => etf.indexWeighting.value === weighting),
    }))
    .filter((group) => group.funds.length > 0);
}
