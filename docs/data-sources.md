# ETF data sources

This document records where each value in [`data/etfs.ts`](../data/etfs.ts) comes from, when it was checked, and what is not known. All sources were retrieved on **2026-10-11**.

## Rules

- Values come only from documents written by the fund's issuer: product pages, fact sheets and prospectuses. Third-party comparison sites and search snippets are not sources.
- Each verified field lists the ids of the sources that state it and an as-of date.
- A value that could not be confirmed is stored as `unverified` with a reason and no value. It must not be shown as fact.
- The listing venue is copied from the issuer's wording. "NYSE" and "NYSE Arca" are separate venues and are separate values in `LISTING_VENUES`.
- Domicile is a separate field from the listing venue.

## Selected funds

Five US-listed ETFs giving exposure to the companies in the S&P 500.

| Ticker | Official name | Issuer | Listing venue | Index | Weighting | Expense ratio (% p.a.) | Inception | Distributions |
|---|---|---|---|---|---|---|---|---|
| SPY | State Street® SPDR® S&P 500® ETF Trust | State Street Investment Management | NYSE Arca | S&P 500 Index | Float-adjusted market cap | 0.0945 | 1993-01-22 | Quarterly |
| SPYM | State Street® SPDR® Portfolio S&P 500® ETF | State Street Investment Management | NYSE Arca | S&P 500 Index | Float-adjusted market cap | 0.02 | 2005-11-08 | Quarterly |
| IVV | iShares Core S&P 500 ETF | iShares by BlackRock | NYSE Arca | S&P 500 Index | Float-adjusted market cap | 0.03 | 2000-05-15 | Quarterly |
| VOO | Vanguard S&P 500 ETF | Vanguard | NYSE Arca | S&P 500 Index | Float-adjusted market cap | 0.03 | 2010-09-07 | Quarterly |
| RSP | Invesco S&P 500® Equal Weight ETF | Invesco | NYSE Arca | S&P 500 Equal Weight Index | Equal | 0.20 | 2003-04-24 | unverified |

All five funds are listed on NYSE Arca according to their issuers. None is listed on the New York Stock Exchange itself.

## Sources and the fields they support

### SPY

| Source id | Document | Date on document | Fields |
|---|---|---|---|
| `spy-page` | [SSGA product page](https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy) | "Fund Information" and "Listing Information" as of 2026-10-11 | name, listing venue ("NYSE ARCA"), domicile (US ISIN), legal structure (unit investment trust), index, weighting, expense ratio ("Gross Expense Ratio 0.0945%"), inception date, distribution frequency |

The issuer's fact sheet (not recorded as a source) shows the same gross and net expense ratio, 0.0945.

### SPYM

| Source id | Document | Date on document | Fields |
|---|---|---|---|
| `spym-page` | [SSGA product page](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-portfolio-sp-500-etf-spym) | "Fund Information" and "Listing Information" as of 2026-10-11 | name, listing venue ("NYSE ARCA"), domicile, index, weighting, expense ratio ("Gross Expense Ratio 0.02%"), inception date, distribution frequency |

### IVV

| Source id | Document | Date on document | Fields |
|---|---|---|---|
| `ivv-prospectus` | [iShares Trust prospectus](https://www.ishares.com/us/literature/prospectus/p-ishares-trust-us-sp-cap-non-sector-3-31.pdf) | 2026-07-31 | name, listing venue (cover: "IVV \| NYSE Arca"), domicile, weighting, expense ratio (fee table, 0.03%) |
| `ivv-fact-sheet` | [iShares fact sheet](https://www.ishares.com/us/literature/fact-sheet/ivv-ishares-core-s-p-500-etf-fund-fact-sheet-en-us.pdf) | 2026-06-30 | name, listing venue, index, expense ratio, inception date, distribution frequency |
| `ivv-page` | [iShares product page](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf) | none for these fields | listing venue, index, inception date, distribution frequency |

### VOO

| Source id | Document | Date on document | Fields |
|---|---|---|---|
| `voo-prospectus` | [Vanguard prospectus](https://fund-docs.vanguard.com/p968.pdf) | 2026-04-28 | name, listing venue (cover: "listed on NYSE Arca"), domicile, legal structure, index, weighting, expense ratio (fee table, 0.03%), distribution frequency |
| `voo-fact-sheet` | [Vanguard fact sheet](https://institutional.vanguard.com/iippdf/pdfs/FS968R.pdf) | 2026-06-30 | name, listing venue, index, expense ratio, inception date, distribution frequency |

### RSP

| Source id | Document | Date on document | Fields |
|---|---|---|---|
| `rsp-summary-prospectus` | [Summary prospectus, Form 497K, on SEC EDGAR](https://www.sec.gov/Archives/edgar/data/1209466/000119312526372163/d177078d497k.htm) | 2026-08-28 | name, listing venue (cover: "NYSE Arca, Inc."), domicile, index, weighting, expense ratio (fee table, 0.20%), inception date (performance table, 2003-04-24) |

Invesco's own website refused automated requests, so its [product page](https://www.invesco.com/us/en/financial-products/etfs/invesco-sp-500-equal-weight-etf.html) could not be read. The summary prospectus is written by Invesco and filed with the SEC; it is the only RSP source. It was first read through a text-extraction tool rather than as a raw file, because SEC EDGAR also refused a direct download. On 2026-10-11 the project owner reviewed the filing by hand and confirmed the ticker, the listing venue, the 0.20% fee, the index and the inception date of 2003-04-24 shown in the performance table. The filing states that performance up to April 6, 2018 is that of a predecessor fund.

## How the values were checked

- SPY, SPYM and IVV product pages: the raw HTML was downloaded and the relevant table cells were read directly.
- IVV and VOO fact sheets and prospectuses: the PDFs were downloaded and read directly.
- RSP: text extraction, then human review of the filing; see the note above.

## Comparability

- **SPY, SPYM, IVV and VOO track the same index**, the S&P 500 Index, which is weighted by float-adjusted market capitalisation. Between these four, the expense ratio is the main difference recorded here.
- **RSP tracks a different index**, the S&P 500 Equal Weight Index. It holds the same companies, but gives each the same weight at every quarterly rebalance. Its returns, sector mix and turnover therefore differ from the other four, and its higher fee is not a like-for-like comparison. The page must present it as a different strategy.
- **Legal structure differs.** SPY is a unit investment trust. VOO is an ETF share class of Vanguard 500 Index Fund. The structure of SPYM, IVV and RSP was not recorded.
- **Expense ratio labels differ by issuer.** State Street publishes a "Gross Expense Ratio"; BlackRock, Vanguard and Invesco publish "Total Annual Fund Operating Expenses" in the prospectus fee table. Both describe total annual operating expenses before any waiver. No fee waiver was shown for any of the five funds in the sources read.

## Units

`expenseRatioPercentPerYear` is a percentage per year. A value of `0.03` means 0.03 % per year, which is 3 basis points, not 3 %. Calculations should use `expenseRatioFraction()`, which returns the value divided by 100.

## Known limitations

- **Domicile is recorded at country level only.** It is "US" for all five funds, based on the evidence noted on each record: a US ISIN, a US prospectus under the Investment Company Act of 1940, or an SEC filing. The state of organisation and legal form were not confirmed, except where `legalStructure` is verified.
- **RSP distribution frequency is unverified.** The summary prospectus does not state how often distributions are paid, and no other primary source could be read. It must not be assumed to be quarterly.
- **PRIIPs KID availability is unverified for every fund.** No issuer or regulatory source was checked. The data makes no claim that a KID exists or does not exist, and the page must not infer that one is missing.
- **As-of dates differ between funds**, from 2026-04-28 (VOO prospectus) to 2026-10-11 (State Street pages). Expense ratios in prospectuses can change at the next annual update.
- **The State Street URLs are in the "intermediary" section** of ssga.com. The fund data shown is the same fund, but the page is addressed to financial professionals.
- **No performance, assets, yield or holdings data is stored.** These go stale quickly and are outside this data set.
- **The data is a manual snapshot.** There is no automated refresh. Re-check every source and update `retrievedOn` and `asOf` before publishing.
