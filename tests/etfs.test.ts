import { describe, expect, it } from "vitest";
import {
  LISTING_VENUES,
  etfs,
  expenseRatioFraction,
  getEtf,
  isVerified,
  sourcesFor,
  verifiedValue,
  type Etf,
  type MaybeVerified,
  type Verified,
} from "@/data/etfs";

// Hosts that count as an official source for each source kind. A third-party
// comparison site can never satisfy these.
const ISSUER_HOSTS = ["ssga.com", "ishares.com", "vanguard.com", "invesco.com"];
const SEC_HOST = "sec.gov";

const REQUIRED_FIELDS = [
  "name",
  "listingVenue",
  "domicile",
  "indexName",
  "indexWeighting",
  "expenseRatioPercentPerYear",
] as const satisfies readonly (keyof Etf)[];

const OPTIONAL_FIELDS = [
  "legalStructure",
  "inceptionDate",
  "distributionFrequency",
  "priipsKidAvailable",
] as const satisfies readonly (keyof Etf)[];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hostMatches(url: string, allowed: string[]): boolean {
  const host = new URL(url).hostname;
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function latestRetrieval(etf: Etf): string {
  return etf.sources.map((source) => source.retrievedOn).sort().at(-1)!;
}

describe("ETF data set", () => {
  it("contains funds with unique, well-formed tickers", () => {
    expect(etfs.length).toBeGreaterThan(0);
    const tickers = etfs.map((etf) => etf.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
    for (const ticker of tickers) {
      expect(ticker).toMatch(/^[A-Z]{1,5}$/);
      expect(getEtf(ticker)?.ticker).toBe(ticker);
    }
  });

  it("gives every fund a non-empty issuer and official name", () => {
    for (const etf of etfs) {
      expect(etf.issuer.trim()).not.toBe("");
      expect(etf.name.value.trim()).not.toBe("");
    }
  });
});

describe.each(etfs)("$ticker sources", (etf) => {
  it("lists at least one source, each with a unique id", () => {
    expect(etf.sources.length).toBeGreaterThan(0);
    const ids = etf.sources.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only official hosts over https, matching the declared source kind", () => {
    for (const source of etf.sources) {
      expect(new URL(source.url).protocol).toBe("https:");
      if (source.kind === "issuer-sec-filing") {
        expect(hostMatches(source.url, [SEC_HOST])).toBe(true);
        expect(new URL(source.url).pathname).toMatch(/^\/Archives\/edgar\//);
      } else {
        expect(hostMatches(source.url, ISSUER_HOSTS)).toBe(true);
      }
    }
  });

  it("has valid retrieval and document dates, with documents not post-dating retrieval", () => {
    for (const source of etf.sources) {
      expect(isRealIsoDate(source.retrievedOn)).toBe(true);
      if (source.documentDate !== undefined) {
        expect(isRealIsoDate(source.documentDate)).toBe(true);
        expect(source.documentDate <= source.retrievedOn).toBe(true);
      }
    }
  });

  it("references every listed source from at least one field", () => {
    const used = new Set(
      ALL_FIELDS.flatMap((key) => {
        const field = etf[key] as MaybeVerified<unknown>;
        return isVerified(field) ? field.sourceIds : [];
      }),
    );
    for (const source of etf.sources) {
      expect(used.has(source.id)).toBe(true);
    }
  });
});

describe.each(etfs)("$ticker field provenance", (etf) => {
  it("has every required field verified", () => {
    for (const key of REQUIRED_FIELDS) {
      expect(etf[key].status).toBe("verified");
    }
  });

  it("backs every verified field with sources that exist on the same fund", () => {
    for (const key of ALL_FIELDS) {
      const field = etf[key] as MaybeVerified<unknown>;
      if (!isVerified(field)) continue;
      expect(field.sourceIds.length).toBeGreaterThan(0);
      expect(sourcesFor(etf, field)).toHaveLength(new Set(field.sourceIds).size);
    }
  });

  it("dates every verified field no later than the data was retrieved", () => {
    const retrieved = latestRetrieval(etf);
    for (const key of ALL_FIELDS) {
      const field = etf[key] as MaybeVerified<unknown>;
      if (!isVerified(field)) continue;
      expect(isRealIsoDate(field.asOf)).toBe(true);
      expect(field.asOf <= retrieved).toBe(true);
    }
  });

  it("never attaches a value or sources to an unverified field", () => {
    for (const key of OPTIONAL_FIELDS) {
      const field = etf[key] as MaybeVerified<unknown>;
      if (isVerified(field)) continue;
      expect(field).not.toHaveProperty("value");
      expect(field).not.toHaveProperty("sourceIds");
      expect(field.reason.trim()).not.toBe("");
      expect(verifiedValue(field)).toBeUndefined();
    }
  });
});

describe.each(etfs)("$ticker listing venue and domicile", (etf) => {
  it("uses an exact venue from the closed list", () => {
    expect(LISTING_VENUES).toContain(etf.listingVenue.value);
  });

  it("takes the venue from an issuer document, not a product page alone when a document exists", () => {
    const kinds = sourcesFor(etf, etf.listingVenue).map((source) => source.kind);
    expect(kinds.length).toBeGreaterThan(0);
    const hasDocument = etf.sources.some((source) => source.kind !== "issuer-product-page");
    if (hasDocument) {
      expect(kinds.some((kind) => kind !== "issuer-product-page")).toBe(true);
    }
  });

  it("keeps domicile as a country code in a separate field from the venue", () => {
    expect(etf.domicile).not.toBe(etf.listingVenue);
    expect(etf.domicile.value).toMatch(/^[A-Z]{2}$/);
    expect(LISTING_VENUES as readonly string[]).not.toContain(etf.domicile.value);
  });
});

describe("listing venue list", () => {
  it("keeps NYSE and NYSE Arca as two distinct entries", () => {
    expect(LISTING_VENUES).toContain("NYSE");
    expect(LISTING_VENUES).toContain("NYSE Arca");
    expect(LISTING_VENUES.indexOf("NYSE")).not.toBe(LISTING_VENUES.indexOf("NYSE Arca"));
  });

  it("has no entries that collide once case and spacing are ignored", () => {
    const normalised = LISTING_VENUES.map((venue) => venue.toLowerCase().replace(/\s+/g, ""));
    expect(new Set(normalised).size).toBe(LISTING_VENUES.length);
  });
});

describe.each(etfs)("$ticker expense ratio", (etf) => {
  const percent = etf.expenseRatioPercentPerYear.value;

  it("is a finite percentage within a plausible range for an index ETF", () => {
    expect(Number.isFinite(percent)).toBe(true);
    // At least 0.01 % (one basis point) and below 3 %: a value entered as a
    // fraction (0.0003) or as basis points (3) for the same fee would fail.
    expect(percent).toBeGreaterThanOrEqual(0.01);
    expect(percent).toBeLessThan(3);
  });

  it("converts to a fraction that is exactly one hundredth of the percentage", () => {
    expect(expenseRatioFraction(etf)).toBeCloseTo(percent / 100, 12);
    expect(expenseRatioFraction(etf)).toBeLessThan(0.03);
  });

  it("comes from a dated fee statement", () => {
    const field: Verified<number> = etf.expenseRatioPercentPerYear;
    expect(isRealIsoDate(field.asOf)).toBe(true);
    expect(sourcesFor(etf, field).length).toBeGreaterThan(0);
  });
});

describe.each(etfs)("$ticker optional data", (etf) => {
  it("has a real inception date in the past when one is verified", () => {
    const inception = verifiedValue(etf.inceptionDate);
    if (inception === undefined) return;
    expect(isRealIsoDate(inception)).toBe(true);
    expect(inception < latestRetrieval(etf)).toBe(true);
  });

  it("does not claim a PRIIPs KID status without a source", () => {
    const field = etf.priipsKidAvailable;
    if (isVerified(field)) {
      expect(sourcesFor(etf, field).length).toBeGreaterThan(0);
    } else {
      expect(verifiedValue(field)).toBeUndefined();
    }
  });
});
