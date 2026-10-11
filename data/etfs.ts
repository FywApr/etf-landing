// ETF reference data, hand-curated from official issuer documents.
// Every figure carries the sources that support it. Do not add or change a
// value without a source; see docs/data-sources.md for the verification log.

/** Calendar date in ISO 8601 form, e.g. "2026-10-11". */
export type IsoDate = `${number}-${number}-${number}`;

/**
 * Listing venues are a closed set of exact strings. "NYSE" (New York Stock
 * Exchange) and "NYSE Arca" are different exchanges and must never be merged
 * or normalised into one another.
 */
export const LISTING_VENUES = ["NYSE", "NYSE Arca", "Nasdaq", "Cboe BZX"] as const;
export type ListingVenue = (typeof LISTING_VENUES)[number];

/** ISO 3166-1 alpha-2 country of the fund's legal home. Not a trading venue. */
export type DomicileCountry = "US";

export type IndexWeighting = "float-adjusted-market-cap" | "equal";
export type DistributionFrequency = "quarterly";

export type SourceKind =
  | "issuer-product-page"
  | "issuer-fact-sheet"
  | "issuer-prospectus"
  // Issuer-authored summary prospectus, retrieved from the SEC's EDGAR system.
  | "issuer-sec-filing";

export interface EtfSource {
  id: string;
  kind: SourceKind;
  publisher: string;
  title: string;
  url: string;
  retrievedOn: IsoDate;
  /** Date printed on the document itself, where it has one. */
  documentDate?: IsoDate;
}

export interface Verified<T> {
  status: "verified";
  value: T;
  /** Ids of the sources (within the same fund) that state this value. */
  sourceIds: [string, ...string[]];
  /**
   * Date the source gives for the value. Where the source does not date the
   * statement, the document date, or failing that the retrieval date.
   */
  asOf: IsoDate;
  note?: string;
}

/** Deliberately has no `value`, so unverified data cannot be displayed as fact. */
export interface Unverified {
  status: "unverified";
  reason: string;
}

export type MaybeVerified<T> = Verified<T> | Unverified;

export interface Etf {
  ticker: string;
  /** Official fund name as printed by the issuer. */
  name: Verified<string>;
  issuer: string;
  listingVenue: Verified<ListingVenue>;
  domicile: Verified<DomicileCountry>;
  legalStructure: MaybeVerified<string>;
  indexName: Verified<string>;
  indexWeighting: Verified<IndexWeighting>;
  /**
   * Annual fund operating expenses in percent per year: 0.03 means 0.03 % of
   * the investment per year, not 3 %. Use `expenseRatioFraction` for maths.
   */
  expenseRatioPercentPerYear: Verified<number>;
  inceptionDate: MaybeVerified<IsoDate>;
  distributionFrequency: MaybeVerified<DistributionFrequency>;
  /** Whether a PRIIPs key information document exists for EEA retail investors. */
  priipsKidAvailable: MaybeVerified<boolean>;
  sources: EtfSource[];
}

const RETRIEVED_ON: IsoDate = "2026-10-11";

const KID_NOT_CHECKED: Unverified = {
  status: "unverified",
  reason:
    "Not checked against an issuer or regulatory source. The absence of a KID must not be inferred.",
};

export const etfs: Etf[] = [
  {
    ticker: "SPY",
    name: {
      status: "verified",
      value: "State Street® SPDR® S&P 500® ETF Trust",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
    },
    issuer: "State Street Investment Management",
    listingVenue: {
      status: "verified",
      value: "NYSE Arca",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
      note: 'Listing Information table, column "Exchange": "NYSE ARCA".',
    },
    domicile: {
      status: "verified",
      value: "US",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
      note: "Country level only, based on the US ISIN (US78462F1030) shown by the issuer.",
    },
    legalStructure: {
      status: "verified",
      value: "Unit investment trust",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
    },
    indexName: {
      status: "verified",
      value: "S&P 500 Index",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
    },
    indexWeighting: {
      status: "verified",
      value: "float-adjusted-market-cap",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
    },
    expenseRatioPercentPerYear: {
      status: "verified",
      value: 0.0945,
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
      note: 'Published as "Gross Expense Ratio".',
    },
    inceptionDate: {
      status: "verified",
      value: "1993-01-22",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
    },
    distributionFrequency: {
      status: "verified",
      value: "quarterly",
      sourceIds: ["spy-page"],
      asOf: "2026-10-11",
    },
    priipsKidAvailable: KID_NOT_CHECKED,
    sources: [
      {
        id: "spy-page",
        kind: "issuer-product-page",
        publisher: "State Street Investment Management",
        title: "State Street SPDR S&P 500 ETF Trust (SPY) product page",
        url: "https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy",
        retrievedOn: RETRIEVED_ON,
      },
    ],
  },
  {
    ticker: "SPYM",
    name: {
      status: "verified",
      value: "State Street® SPDR® Portfolio S&P 500® ETF",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
    },
    issuer: "State Street Investment Management",
    listingVenue: {
      status: "verified",
      value: "NYSE Arca",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
      note: 'Listing Information table, column "Exchange": "NYSE ARCA".',
    },
    domicile: {
      status: "verified",
      value: "US",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
      note: "Country level only, based on the US ISIN (US78464A8541) and the fund's classification under the US Investment Company Act of 1940, both shown by the issuer.",
    },
    legalStructure: {
      status: "unverified",
      reason: "Legal form and state of organisation were not read from an issuer document.",
    },
    indexName: {
      status: "verified",
      value: "S&P 500 Index",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
    },
    indexWeighting: {
      status: "verified",
      value: "float-adjusted-market-cap",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
    },
    expenseRatioPercentPerYear: {
      status: "verified",
      value: 0.02,
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
      note: 'Published as "Gross Expense Ratio".',
    },
    inceptionDate: {
      status: "verified",
      value: "2005-11-08",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
    },
    distributionFrequency: {
      status: "verified",
      value: "quarterly",
      sourceIds: ["spym-page"],
      asOf: "2026-10-11",
    },
    priipsKidAvailable: KID_NOT_CHECKED,
    sources: [
      {
        id: "spym-page",
        kind: "issuer-product-page",
        publisher: "State Street Investment Management",
        title: "State Street SPDR Portfolio S&P 500 ETF (SPYM) product page",
        url: "https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-portfolio-sp-500-etf-spym",
        retrievedOn: RETRIEVED_ON,
      },
    ],
  },
  {
    ticker: "IVV",
    name: {
      status: "verified",
      value: "iShares Core S&P 500 ETF",
      sourceIds: ["ivv-prospectus", "ivv-fact-sheet"],
      asOf: "2026-07-31",
    },
    issuer: "iShares by BlackRock",
    listingVenue: {
      status: "verified",
      value: "NYSE Arca",
      sourceIds: ["ivv-prospectus", "ivv-fact-sheet", "ivv-page"],
      asOf: "2026-07-31",
      note: 'Prospectus cover: "iShares Core S&P 500 ETF | IVV | NYSE Arca".',
    },
    domicile: {
      status: "verified",
      value: "US",
      sourceIds: ["ivv-prospectus"],
      asOf: "2026-07-31",
      note: "Country level only, based on the fund being offered under a US prospectus governed by the Investment Company Act of 1940.",
    },
    legalStructure: {
      status: "unverified",
      reason: "Legal form and state of organisation were not read from an issuer document.",
    },
    indexName: {
      status: "verified",
      value: "S&P 500 Index",
      sourceIds: ["ivv-fact-sheet", "ivv-page"],
      asOf: "2026-06-30",
    },
    indexWeighting: {
      status: "verified",
      value: "float-adjusted-market-cap",
      sourceIds: ["ivv-prospectus"],
      asOf: "2026-07-31",
    },
    expenseRatioPercentPerYear: {
      status: "verified",
      value: 0.03,
      sourceIds: ["ivv-prospectus", "ivv-fact-sheet"],
      asOf: "2026-07-31",
      note: 'Prospectus fee table: "Total Annual Fund Operating Expenses".',
    },
    inceptionDate: {
      status: "verified",
      value: "2000-05-15",
      sourceIds: ["ivv-fact-sheet", "ivv-page"],
      asOf: "2026-06-30",
    },
    distributionFrequency: {
      status: "verified",
      value: "quarterly",
      sourceIds: ["ivv-fact-sheet", "ivv-page"],
      asOf: "2026-06-30",
    },
    priipsKidAvailable: KID_NOT_CHECKED,
    sources: [
      {
        id: "ivv-page",
        kind: "issuer-product-page",
        publisher: "BlackRock (iShares)",
        title: "iShares Core S&P 500 ETF (IVV) product page",
        url: "https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf",
        retrievedOn: RETRIEVED_ON,
      },
      {
        id: "ivv-fact-sheet",
        kind: "issuer-fact-sheet",
        publisher: "BlackRock (iShares)",
        title: "iShares Core S&P 500 ETF fact sheet",
        url: "https://www.ishares.com/us/literature/fact-sheet/ivv-ishares-core-s-p-500-etf-fund-fact-sheet-en-us.pdf",
        retrievedOn: RETRIEVED_ON,
        documentDate: "2026-06-30",
      },
      {
        id: "ivv-prospectus",
        kind: "issuer-prospectus",
        publisher: "BlackRock (iShares)",
        title: "iShares Trust prospectus (iShares Core S&P ETFs)",
        url: "https://www.ishares.com/us/literature/prospectus/p-ishares-trust-us-sp-cap-non-sector-3-31.pdf",
        retrievedOn: RETRIEVED_ON,
        documentDate: "2026-07-31",
      },
    ],
  },
  {
    ticker: "VOO",
    name: {
      status: "verified",
      value: "Vanguard S&P 500 ETF",
      sourceIds: ["voo-prospectus", "voo-fact-sheet"],
      asOf: "2026-04-28",
    },
    issuer: "Vanguard",
    listingVenue: {
      status: "verified",
      value: "NYSE Arca",
      sourceIds: ["voo-prospectus", "voo-fact-sheet"],
      asOf: "2026-04-28",
      note: 'Prospectus cover: "listed on NYSE Arca".',
    },
    domicile: {
      status: "verified",
      value: "US",
      sourceIds: ["voo-prospectus"],
      asOf: "2026-04-28",
      note: "Country level only, based on the prospectus stating the ETF shares are issued by a registered investment company under the Investment Company Act of 1940.",
    },
    legalStructure: {
      status: "verified",
      value: "ETF share class of Vanguard 500 Index Fund",
      sourceIds: ["voo-prospectus"],
      asOf: "2026-04-28",
    },
    indexName: {
      status: "verified",
      value: "S&P 500 Index",
      sourceIds: ["voo-prospectus", "voo-fact-sheet"],
      asOf: "2026-04-28",
    },
    indexWeighting: {
      status: "verified",
      value: "float-adjusted-market-cap",
      sourceIds: ["voo-prospectus"],
      asOf: "2026-04-28",
    },
    expenseRatioPercentPerYear: {
      status: "verified",
      value: 0.03,
      sourceIds: ["voo-prospectus", "voo-fact-sheet"],
      asOf: "2026-04-28",
      note: 'Prospectus fee table: "Total Annual Fund Operating Expenses".',
    },
    inceptionDate: {
      status: "verified",
      value: "2010-09-07",
      sourceIds: ["voo-fact-sheet"],
      asOf: "2026-06-30",
    },
    distributionFrequency: {
      status: "verified",
      value: "quarterly",
      sourceIds: ["voo-prospectus", "voo-fact-sheet"],
      asOf: "2026-04-28",
    },
    priipsKidAvailable: KID_NOT_CHECKED,
    sources: [
      {
        id: "voo-fact-sheet",
        kind: "issuer-fact-sheet",
        publisher: "Vanguard",
        title: "Vanguard S&P 500 ETF (VOO) fact sheet",
        url: "https://institutional.vanguard.com/iippdf/pdfs/FS968R.pdf",
        retrievedOn: RETRIEVED_ON,
        documentDate: "2026-06-30",
      },
      {
        id: "voo-prospectus",
        kind: "issuer-prospectus",
        publisher: "Vanguard",
        title: "Vanguard S&P 500 ETF prospectus",
        url: "https://fund-docs.vanguard.com/p968.pdf",
        retrievedOn: RETRIEVED_ON,
        documentDate: "2026-04-28",
      },
    ],
  },
  {
    ticker: "RSP",
    name: {
      status: "verified",
      value: "Invesco S&P 500® Equal Weight ETF",
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
    },
    issuer: "Invesco",
    listingVenue: {
      status: "verified",
      value: "NYSE Arca",
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
      note: 'Summary prospectus cover: "NYSE Arca, Inc.".',
    },
    domicile: {
      status: "verified",
      value: "US",
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
      note: "Country level only, based on the fund's summary prospectus being filed with the US SEC under Securities Act Rule 497(k).",
    },
    legalStructure: {
      status: "unverified",
      reason: "Legal form and state of organisation were not read from an issuer document.",
    },
    indexName: {
      status: "verified",
      value: "S&P 500 Equal Weight Index",
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
    },
    indexWeighting: {
      status: "verified",
      value: "equal",
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
      note: "Each component is assigned the same weight at each quarterly rebalance.",
    },
    expenseRatioPercentPerYear: {
      status: "verified",
      value: 0.2,
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
      note: 'Fee table: "Total Annual Fund Operating Expenses".',
    },
    inceptionDate: {
      status: "verified",
      value: "2003-04-24",
      sourceIds: ["rsp-summary-prospectus"],
      asOf: "2026-08-28",
      note: "Inception date shown in the performance table, confirmed by human review of the filing. Performance up to April 6, 2018 is that of a predecessor fund.",
    },
    distributionFrequency: {
      status: "unverified",
      reason: "The summary prospectus does not state how often distributions are paid.",
    },
    priipsKidAvailable: KID_NOT_CHECKED,
    sources: [
      {
        id: "rsp-summary-prospectus",
        kind: "issuer-sec-filing",
        publisher: "Invesco Exchange-Traded Fund Trust (filed with the US SEC)",
        title: "Invesco S&P 500 Equal Weight ETF summary prospectus (Form 497K)",
        url: "https://www.sec.gov/Archives/edgar/data/1209466/000119312526372163/d177078d497k.htm",
        retrievedOn: RETRIEVED_ON,
        documentDate: "2026-08-28",
      },
    ],
  },
];

export function isVerified<T>(field: MaybeVerified<T>): field is Verified<T> {
  return field.status === "verified";
}

/** The field's value, or `undefined` when it has not been verified. */
export function verifiedValue<T>(field: MaybeVerified<T>): T | undefined {
  return isVerified(field) ? field.value : undefined;
}

export function getEtf(ticker: string): Etf | undefined {
  return etfs.find((etf) => etf.ticker === ticker);
}

/** Expense ratio as a plain fraction per year: 0.03 % becomes 0.0003. */
export function expenseRatioFraction(etf: Etf): number {
  return etf.expenseRatioPercentPerYear.value / 100;
}

/** The sources backing one field, resolved from the fund's source list. */
export function sourcesFor(etf: Etf, field: Verified<unknown>): EtfSource[] {
  return etf.sources.filter((source) => field.sourceIds.includes(source.id));
}
