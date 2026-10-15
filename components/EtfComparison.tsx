import { ComparisonViewMarker } from "@/components/Analytics";
import { ArrowIcon } from "@/components/Brand";
import { SectionHeading } from "@/components/SectionHeading";
import { TerBar } from "@/components/TerBar";
import {
  isVerified,
  sourcesFor,
  type Etf,
  type EtfSource,
  type MaybeVerified,
} from "@/data/etfs";
import {
  EQUAL_WEIGHT_LABEL,
  UNVERIFIED_LABEL,
  distributionLabels,
  domicileLabels,
  groupByWeighting,
  inceptionNotes,
  isEqualWeight,
  snapshotDate,
  sourceKindLabels,
  terScaleMax,
  weightingLabels,
  type WeightingGroup,
} from "@/lib/etf-view";
import { formatDate, formatPercent } from "@/lib/format";

function Unverified() {
  return (
    <span className="inline-block rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-xs text-muted">
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

function HatchSwatch() {
  return (
    <span
      aria-hidden="true"
      className="hatch inline-block h-2.5 w-4 shrink-0 rounded-[2px] text-ink ring-1 ring-ink ring-inset"
    />
  );
}

function StrategyBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-ink bg-card px-2 py-1 text-xs font-medium">
      <HatchSwatch />
      {EQUAL_WEIGHT_LABEL}
    </span>
  );
}

function GroupTitle({ group }: { group: WeightingGroup }) {
  return group.weighting === "equal" ? (
    <span className="flex items-center gap-2">
      <HatchSwatch />
      {EQUAL_WEIGHT_LABEL}
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-2.5 w-4 shrink-0 rounded-[2px] bg-ink" />
      {group.funds[0].indexName.value} · {weightingLabels[group.weighting].toLowerCase()}
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
      className="link inline-flex min-h-11 items-center gap-1.5 font-medium"
      aria-label={`Oficiální zdroj pro ${etf.ticker}: ${sourceKindLabels[source.kind]} (otevře se v novém okně)`}
    >
      Oficiální zdroj
      <ArrowIcon direction="up-right" />
    </a>
  );
}

function FundCard({ etf, scaleMax }: { etf: Etf; scaleMax: number }) {
  const equalWeight = isEqualWeight(etf);
  return (
    <li
      className={`relative overflow-hidden rounded-panel border bg-card p-4 sm:p-5 ${
        equalWeight ? "border-ink" : "border-line"
      }`}
    >
      {equalWeight && (
        <span aria-hidden="true" className="hatch absolute inset-x-0 top-0 h-1.5 text-ink" />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-[2rem] leading-none font-bold">{etf.ticker}</h3>
          <p className="mt-2 text-sm text-muted">{etf.name.value}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="label-mono text-muted">TER ročně</p>
          <p className="num mt-1 text-2xl font-semibold">
            {formatPercent(etf.expenseRatioPercentPerYear.value)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <TerBar
          valuePct={etf.expenseRatioPercentPerYear.value}
          scaleMax={scaleMax}
          equalWeight={equalWeight}
          tone="paper"
        />
      </div>

      {equalWeight && (
        <p className="mt-4">
          <StrategyBadge />
        </p>
      )}

      <p className="mt-4 flex flex-wrap justify-between gap-x-3 border-t border-line pt-4 text-sm">
        <span>{etf.issuer}</span>
        <span className="text-muted">{etf.indexName.value}</span>
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 text-sm">
        <div>
          <dt className="label-mono text-muted">Burza</dt>
          <dd className="mt-0.5">{etf.listingVenue.value}</dd>
        </div>
        <div>
          <dt className="label-mono text-muted">Vznik</dt>
          <dd className="num mt-0.5">
            <FieldValue field={etf.inceptionDate} format={formatDate} />
          </dd>
        </div>
        <div>
          <dt className="label-mono text-muted">Domicil</dt>
          <dd className="mt-0.5">{domicileLabels[etf.domicile.value]}</dd>
        </div>
      </dl>

      <p className="mt-2 text-sm">
        <PrimarySourceLink etf={etf} />
      </p>
    </li>
  );
}

function ComparisonTable({ groups, scaleMax }: { groups: WeightingGroup[]; scaleMax: number }) {
  const head = "label-mono px-4 py-3.5 font-normal first:pl-6 last:pr-6";
  const cell = "px-4 py-5 first:pl-6 last:pr-6";
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-card">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Srovnání vybraných ETF kotovaných v USA</caption>
        <thead className="bg-ink text-paper">
          <tr>
            <th scope="col" className={head}>Fond</th>
            <th scope="col" className={head}>Sledovaný index</th>
            <th scope="col" className={`${head} text-right`}>TER ročně</th>
            <th scope="col" className={head}>Burza</th>
            <th scope="col" className={head}>Vznik fondu</th>
            <th scope="col" className={head}>Domicil</th>
            <th scope="col" className={head}>Zdroj</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.weighting}>
            <tr className="border-t border-line bg-paper-deep">
              <th scope="rowgroup" colSpan={7} className="label-mono px-6 py-2.5 font-normal text-muted">
                <GroupTitle group={group} />
              </th>
            </tr>
            {group.funds.map((etf) => (
              <tr key={etf.ticker} className="border-t border-line align-top">
                <th scope="row" className={`${cell} font-normal`}>
                  <span className="font-display block text-2xl leading-none font-bold">
                    {etf.ticker}
                  </span>
                  <span className="mt-2 block max-w-[16rem] text-muted">{etf.name.value}</span>
                  <span className="mt-1 block text-xs text-muted">{etf.issuer}</span>
                </th>
                <td className={cell}>
                  <span className="block">{etf.indexName.value}</span>
                  <span className="mt-2 block">
                    {isEqualWeight(etf) ? (
                      <StrategyBadge />
                    ) : (
                      <span className="text-xs text-muted">
                        {weightingLabels[etf.indexWeighting.value]}
                      </span>
                    )}
                  </span>
                </td>
                <td className={`${cell} w-40 text-right`}>
                  <span className="num block text-xl font-semibold whitespace-nowrap">
                    {formatPercent(etf.expenseRatioPercentPerYear.value)}
                  </span>
                  <span className="mt-2.5 block">
                    <TerBar
                      valuePct={etf.expenseRatioPercentPerYear.value}
                      scaleMax={scaleMax}
                      equalWeight={isEqualWeight(etf)}
                      tone="paper"
                    />
                  </span>
                </td>
                <td className={`${cell} whitespace-nowrap`}>{etf.listingVenue.value}</td>
                <td className={`${cell} num whitespace-nowrap`}>
                  <FieldValue field={etf.inceptionDate} format={formatDate} />
                </td>
                <td className={cell}>{domicileLabels[etf.domicile.value]}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <span className="-my-3 block">
                    <PrimarySourceLink etf={etf} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function SourceDetails({ funds }: { funds: Etf[] }) {
  return (
    <details className="group mt-8 rounded-panel border border-line bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-panel px-5 py-3 font-semibold md:px-6 [&::-webkit-details-marker]:hidden">
        Zdroje, data ověření a neověřené údaje
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-lime transition-transform group-open:rotate-45 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 16 16" className="size-3.5">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div className="grid gap-x-10 gap-y-8 border-t border-line px-5 py-6 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {funds.map((etf) => (
          <div key={etf.ticker} className="text-sm">
            <h3 className="flex items-baseline gap-2">
              <span className="font-display text-xl font-bold">{etf.ticker}</span>
              <span className="text-muted">{etf.name.value}</span>
            </h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
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
            <ul className="mt-3 space-y-2 border-t border-line pt-3">
              {etf.sources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link font-medium"
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
  const groups = groupByWeighting(funds);
  const scaleMax = terScaleMax(funds);
  const equalWeightFunds = funds.filter(isEqualWeight);

  return (
    <section id="srovnani" aria-labelledby="srovnani-heading" className="py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <SectionHeading id="srovnani-heading" eyebrow="Srovnání" title="Srovnání vybraných ETF">
          <p>
            Fondy kotované v USA zaměřené na společnosti z indexu S&amp;P 500. Údaje pocházejí z
            dokumentů správců fondů a byly ručně ověřeny k {formatDate(snapshotDate(funds))}. Nejde
            o živá tržní data.
          </p>
        </SectionHeading>

        <ComparisonViewMarker />
        <div className="mt-10 grid gap-8 lg:hidden">
          {groups.map((group) => (
            <div key={group.weighting}>
              <h3 className="label-mono text-muted">
                <GroupTitle group={group} />
              </h3>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {group.funds.map((etf) => (
                  <FundCard key={etf.ticker} etf={etf} scaleMax={scaleMax} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 hidden lg:block">
          <ComparisonTable groups={groups} scaleMax={scaleMax} />
        </div>

        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
          TER = celková roční nákladovost fondu v procentech hodnoty investice. Pruhy ukazují TER
          na lineárním měřítku od nuly do {formatPercent(scaleMax)}; nejde o výkonnost. Domicil je
          ověřen pouze na úrovni země.
        </p>

        {equalWeightFunds.map((etf) => (
          <aside
            key={etf.ticker}
            aria-label={EQUAL_WEIGHT_LABEL}
            className="mt-8 grid grid-cols-[0.5rem_1fr] gap-5 rounded-panel border border-ink bg-card p-5 text-sm md:p-6"
          >
            <span aria-hidden="true" className="hatch rounded-full text-ink" />
            <div>
              <p className="font-semibold">{EQUAL_WEIGHT_LABEL}</p>
              <p className="mt-2 max-w-3xl leading-relaxed">
                {etf.ticker} sleduje {etf.indexName.value}, ve kterém má každá společnost stejnou
                váhu. Ostatní fondy v přehledu sledují index S&amp;P 500 vážený tržní kapitalizací.
                Nejde proto o srovnání stejného indexu a rozdílný poplatek sám o sobě neříká, který
                fond je lepší nebo horší.
              </p>
              {isVerified(etf.inceptionDate) && inceptionNotes[etf.ticker] && (
                <p className="mt-2 max-w-3xl text-muted">
                  Datum vzniku {formatDate(etf.inceptionDate.value)} uvádí souhrnný prospekt z{" "}
                  {formatDate(etf.inceptionDate.asOf)}. {inceptionNotes[etf.ticker]}
                </p>
              )}
            </div>
          </aside>
        ))}

        <SourceDetails funds={funds} />
      </div>
    </section>
  );
}
