import { ComparisonViewMarker } from "@/components/Analytics";
import {
  isVerified,
  sourcesFor,
  type Etf,
  type EtfSource,
  type MaybeVerified,
} from "@/data/etfs";
import {
  UNVERIFIED_LABEL,
  distributionLabels,
  domicileLabels,
  inceptionNotes,
  isEqualWeight,
  snapshotDate,
  sourceKindLabels,
  weightingLabels,
} from "@/lib/etf-view";
import { formatDate, formatPercent } from "@/lib/format";

const EQUAL_WEIGHT_LABEL = "Rovnoměrně vážený index — odlišná strategie";

function Unverified() {
  return (
    <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-muted">
      {UNVERIFIED_LABEL}
    </span>
  );
}

/** Renders a field's value, or an explicit "unverified" marker. Never a guess. */
function FieldValue<T>({
  field,
  format,
}: {
  field: MaybeVerified<T>;
  format: (value: T) => string;
}) {
  return isVerified(field) ? <>{format(field.value)}</> : <Unverified />;
}

function StrategyBadge() {
  return (
    <span className="inline-block rounded border border-warn-line bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">
      {EQUAL_WEIGHT_LABEL}
    </span>
  );
}

function sourceDates(source: EtfSource): string {
  const retrieved = `staženo ${formatDate(source.retrievedOn)}`;
  return source.documentDate
    ? `dokument z ${formatDate(source.documentDate)}, ${retrieved}`
    : retrieved;
}

function PrimarySourceLink({ etf }: { etf: Etf }) {
  const source = sourcesFor(etf, etf.expenseRatioPercentPerYear)[0];
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent underline underline-offset-2 hover:text-accent-strong"
      aria-label={`Oficiální zdroj pro ${etf.ticker}: ${sourceKindLabels[source.kind]} (otevře se v novém okně)`}
    >
      Oficiální zdroj
    </a>
  );
}

function FundCard({ etf }: { etf: Etf }) {
  return (
    <li
      className={`rounded-lg border p-4 ${
        isEqualWeight(etf) ? "border-warn-line bg-warn-soft/40" : "border-line bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{etf.ticker}</h3>
          <p className="text-sm text-muted">{etf.name.value}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">TER ročně</p>
          <p className="text-xl font-semibold tabular-nums">
            {formatPercent(etf.expenseRatioPercentPerYear.value)}
          </p>
        </div>
      </div>

      {isEqualWeight(etf) && (
        <p className="mt-3">
          <StrategyBadge />
        </p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Správce</dt>
        <dd>{etf.issuer}</dd>
        <dt className="text-muted">Index</dt>
        <dd>{etf.indexName.value}</dd>
        <dt className="text-muted">Burza</dt>
        <dd>{etf.listingVenue.value}</dd>
        <dt className="text-muted">Vznik</dt>
        <dd>
          <FieldValue field={etf.inceptionDate} format={formatDate} />
        </dd>
        <dt className="text-muted">Domicil</dt>
        <dd>{domicileLabels[etf.domicile.value]}</dd>
      </dl>

      <p className="mt-3 text-sm">
        <PrimarySourceLink etf={etf} />
      </p>
    </li>
  );
}

function ComparisonTable({ funds }: { funds: Etf[] }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">Srovnání vybraných ETF kotovaných v USA</caption>
      <thead>
        <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <th scope="col" className="py-3 pr-4 font-medium">Fond</th>
          <th scope="col" className="py-3 pr-4 font-medium">Sledovaný index</th>
          <th scope="col" className="py-3 pr-4 text-right font-medium">TER ročně</th>
          <th scope="col" className="py-3 pr-4 font-medium">Burza</th>
          <th scope="col" className="py-3 pr-4 font-medium">Vznik fondu</th>
          <th scope="col" className="py-3 pr-4 font-medium">Domicil</th>
          <th scope="col" className="py-3 font-medium">Zdroj</th>
        </tr>
      </thead>
      <tbody>
        {funds.map((etf) => (
          <tr
            key={etf.ticker}
            className={`border-b border-line align-top ${isEqualWeight(etf) ? "bg-warn-soft/40" : ""}`}
          >
            <th scope="row" className="py-4 pr-4 font-normal">
              <span className="block text-base font-semibold">{etf.ticker}</span>
              <span className="block text-muted">{etf.name.value}</span>
              <span className="block text-xs text-muted">{etf.issuer}</span>
            </th>
            <td className="py-4 pr-4">
              <span className="block">{etf.indexName.value}</span>
              <span className="mt-1 block">
                {isEqualWeight(etf) ? (
                  <StrategyBadge />
                ) : (
                  <span className="text-xs text-muted">
                    {weightingLabels[etf.indexWeighting.value]}
                  </span>
                )}
              </span>
            </td>
            <td className="py-4 pr-4 text-right text-base font-semibold tabular-nums whitespace-nowrap">
              {formatPercent(etf.expenseRatioPercentPerYear.value)}
            </td>
            <td className="py-4 pr-4 whitespace-nowrap">{etf.listingVenue.value}</td>
            <td className="py-4 pr-4 tabular-nums whitespace-nowrap">
              <FieldValue field={etf.inceptionDate} format={formatDate} />
            </td>
            <td className="py-4 pr-4">{domicileLabels[etf.domicile.value]}</td>
            <td className="py-4 whitespace-nowrap">
              <PrimarySourceLink etf={etf} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SourceDetails({ funds }: { funds: Etf[] }) {
  return (
    <details className="mt-6 rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 font-medium">
        Zdroje, data ověření a neověřené údaje
      </summary>
      <div className="grid gap-6 border-t border-line px-4 py-4 md:grid-cols-2">
        {funds.map((etf) => (
          <div key={etf.ticker} className="text-sm">
            <h3 className="font-semibold">
              {etf.ticker} <span className="font-normal text-muted">· {etf.name.value}</span>
            </h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">TER</dt>
              <dd>
                {formatPercent(etf.expenseRatioPercentPerYear.value)}, údaj k{" "}
                {formatDate(etf.expenseRatioPercentPerYear.asOf)}
              </dd>
              <dt className="text-muted">Burza</dt>
              <dd>
                {etf.listingVenue.value}, údaj k {formatDate(etf.listingVenue.asOf)}
              </dd>
              <dt className="text-muted">Výplata výnosů</dt>
              <dd>
                <FieldValue
                  field={etf.distributionFrequency}
                  format={(value) => distributionLabels[value]}
                />
              </dd>
              <dt className="text-muted">KID podle PRIIPs</dt>
              <dd>
                <FieldValue
                  field={etf.priipsKidAvailable}
                  format={(available) => (available ? "K dispozici" : "Není k dispozici")}
                />
              </dd>
            </dl>
            <ul className="mt-2 space-y-1">
              {etf.sources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2 hover:text-accent-strong"
                  >
                    {sourceKindLabels[source.kind]} – {etf.ticker}
                    <span className="sr-only"> (otevře se v novém okně)</span>
                  </a>{" "}
                  <span className="text-muted">({sourceDates(source)})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export function EtfComparison({ funds }: { funds: Etf[] }) {
  const equalWeightFunds = funds.filter(isEqualWeight);

  return (
    <section id="srovnani" aria-labelledby="srovnani-heading" className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-5xl px-4">
        <h2 id="srovnani-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">
          Srovnání vybraných ETF
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Fondy kotované v USA zaměřené na společnosti z indexu S&amp;P 500. Údaje pocházejí z
          dokumentů správců fondů a byly ručně ověřeny k {formatDate(snapshotDate(funds))}. Nejde o
          živá tržní data.
        </p>

        <ComparisonViewMarker />
        <ul className="mt-6 grid gap-3 md:hidden">
          {funds.map((etf) => (
            <FundCard key={etf.ticker} etf={etf} />
          ))}
        </ul>
        <div className="mt-6 hidden md:block">
          <ComparisonTable funds={funds} />
        </div>

        <p className="mt-3 text-xs text-muted">
          TER = celková roční nákladovost fondu v procentech hodnoty investice. Domicil je ověřen
          pouze na úrovni země.
        </p>

        {equalWeightFunds.map((etf) => (
          <div
            key={etf.ticker}
            className="mt-6 rounded-lg border border-warn-line bg-warn-soft p-4 text-sm"
          >
            <p className="font-semibold text-warn">{EQUAL_WEIGHT_LABEL}</p>
            <p className="mt-1">
              {etf.ticker} sleduje {etf.indexName.value}, ve kterém má každá společnost stejnou
              váhu. Ostatní fondy v přehledu sledují index S&amp;P 500 vážený tržní kapitalizací.
              Nejde proto o srovnání stejného indexu a rozdílný poplatek sám o sobě neříká, který
              fond je lepší nebo horší.
            </p>
            {isVerified(etf.inceptionDate) && inceptionNotes[etf.ticker] && (
              <p className="mt-2 text-muted">
                Datum vzniku {formatDate(etf.inceptionDate.value)} uvádí souhrnný prospekt z{" "}
                {formatDate(etf.inceptionDate.asOf)}. {inceptionNotes[etf.ticker]}
              </p>
            )}
          </div>
        ))}

        <SourceDetails funds={funds} />
      </div>
    </section>
  );
}
