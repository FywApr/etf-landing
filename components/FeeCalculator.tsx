"use client";

import { useId, useState } from "react";
import {
  INPUT_LIMITS,
  calculateFeeImpact,
  validateInputs,
  type CalculatorInputs,
  type FeeImpact,
  type InputField,
  type IssueCode,
  type ValidationIssue,
} from "@/lib/calculator";
import { trackOnce } from "@/lib/analytics/client";
import { strategiesDiffer, type CalculatorFund } from "@/lib/etf-view";
import {
  formatCzk,
  formatInteger,
  formatPercent,
  formatShare,
  parseDecimalInput,
} from "@/lib/format";

// Illustrative, user-editable starting values. Not a forecast.
const DEFAULT_VALUES: Record<InputField, string> = {
  initialDeposit: "100000",
  monthlyContribution: "3000",
  years: "20",
  annualReturnPct: "6",
};

const FIELD_UNITS: Record<InputField, string> = {
  initialDeposit: "Kč",
  monthlyContribution: "Kč",
  years: "let",
  annualReturnPct: "%",
};

function fieldMessage(field: InputField, code: IssueCode): string {
  const { min, max } = INPUT_LIMITS[field];
  switch (code) {
    case "invalid-number":
      return "Zadejte číslo, například 1500 nebo 6,5.";
    case "too-low":
    case "too-high":
      return `Zadejte hodnotu od ${formatInteger(min)} do ${formatInteger(max)} ${FIELD_UNITS[field]}.`;
    case "not-integer":
      return "Zadejte celý počet let.";
    default:
      return "Zkontrolujte zadanou hodnotu.";
  }
}

function formMessage(code: IssueCode): string {
  if (code === "no-investment") {
    return "Zadejte počáteční vklad nebo měsíční příspěvek vyšší než nula.";
  }
  return "Pro tuto kombinaci výnosu a nákladů fondu nelze výsledek spolehlivě spočítat.";
}

function NumberField({
  field,
  label,
  hint,
  value,
  issue,
  onChange,
}: {
  field: InputField;
  label: string;
  hint?: string;
  value: string;
  issue?: ValidationIssue;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, issue && `${id}-error`].filter(Boolean).join(" ");

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={issue ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`num h-14 w-full rounded-control border bg-card pl-3.5 pr-12 text-xl font-semibold transition-shadow focus:shadow-[0_0_0_4px_var(--lime)] motion-reduce:transition-none ${
            issue ? "border-2 border-danger" : "border-line-strong"
          }`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted"
        >
          {FIELD_UNITS[field]}
        </span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {issue && (
        <p id={`${id}-error`} className="mt-1.5 flex gap-1.5 text-xs font-medium text-danger">
          <span aria-hidden="true">!</span>
          {fieldMessage(field, issue.code)}
        </p>
      )}
    </div>
  );
}

function FundSelect({
  label,
  value,
  funds,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  funds: CalculatorFund[];
  emptyLabel?: string;
  onChange: (ticker: string) => void;
}) {
  const id = useId();
  return (
    // Full width on narrow screens so the ticker and TER are never clipped.
    <div className="col-span-2 sm:col-span-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 w-full appearance-none rounded-control border border-line-strong bg-card pl-3.5 pr-10 text-base font-semibold transition-shadow focus:shadow-[0_0_0_4px_var(--lime)] motion-reduce:transition-none"
        >
          {emptyLabel && <option value="">{emptyLabel}</option>}
          {funds.map((fund) => (
            <option key={fund.ticker} value={fund.ticker}>
              {fund.ticker} · TER {formatPercent(fund.expenseRatioPct)}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

interface FundResult {
  fund: CalculatorFund;
  result: FeeImpact;
}

function Results({ rows }: { rows: FundResult[] }) {
  const baseline = rows[0].result;
  const largestFeeCost = Math.max(...rows.map((row) => row.result.feeCost));
  const comparing = rows.length === 2;

  return (
    <div>
      <dl className="grid grid-cols-2 border-y border-ink-line">
        <div className="py-4 pr-4">
          <dt className="text-sm text-ink-muted">Celkem vloženo</dt>
          <dd className="num mt-1 text-lg font-semibold">{formatCzk(baseline.totalContributions)}</dd>
        </div>
        <div className="border-l border-ink-line py-4 pl-4">
          <dt className="text-sm text-ink-muted">Hodnota při nulovém TER</dt>
          <dd className="num mt-1 text-lg font-semibold">{formatCzk(baseline.zeroTerValue)}</dd>
          <dd className="mt-0.5 text-xs text-ink-muted">Srovnávací scénář bez nákladů fondu</dd>
        </div>
      </dl>

      <ul className={`mt-5 grid gap-3 ${comparing ? "sm:grid-cols-2" : ""}`}>
        {rows.map(({ fund, result }) => (
          <li key={fund.ticker} className="rounded-2xl border border-ink-line bg-ink p-4 md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 className="font-display text-2xl leading-none font-bold">{fund.ticker}</h4>
              <p className="num text-sm text-ink-muted">
                TER {formatPercent(fund.expenseRatioPct)} ročně
              </p>
            </div>
            <dl className="mt-4">
              <dt className="text-sm text-ink-muted">Modelový vliv nákladů fondu</dt>
              <dd className="num mt-1 text-[2rem] leading-none font-semibold text-lime">
                −{formatCzk(result.feeCost)}
              </dd>
              <dd className="mt-1.5 text-xs text-ink-muted">
                Rozdíl oproti nulovému TER, tj.{" "}
                {formatShare(result.zeroTerValue > 0 ? (result.feeCost / result.zeroTerValue) * 100 : 0)}{" "}
                z této hodnoty
              </dd>
            </dl>
            {comparing && (
              <div aria-hidden="true" className="mt-4 h-2 rounded-full bg-ink-line">
                <div
                  className="h-2 rounded-full bg-lime transition-[width] duration-300 motion-reduce:transition-none"
                  style={{
                    width: `${largestFeeCost > 0 ? (result.feeCost / largestFeeCost) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
            <dl className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink-line pt-3 text-sm">
              <dt className="text-ink-muted">Odhad konečné hodnoty po nákladech fondu</dt>
              <dd className="num font-semibold">{formatCzk(result.finalValue)}</dd>
            </dl>
          </li>
        ))}
      </ul>

      {comparing && (
        <>
          <p className="mt-2 text-xs text-ink-muted">
            Pruhy porovnávají modelový vliv nákladů obou fondů; delší pruh odpovídá vyššímu
            vlivu.
          </p>
          <p className="mt-4 rounded-2xl bg-lime p-4 text-sm leading-relaxed text-ink">
            Rozdíl mezi {rows[0].fund.ticker} a {rows[1].fund.ticker} v tomto modelu:{" "}
            <strong className="num font-semibold">
              {formatCzk(Math.abs(rows[0].result.finalValue - rows[1].result.finalValue))}
            </strong>{" "}
            na konečné hodnotě. Vyplývá pouze z rozdílu TER při stejném předpokládaném výnosu.
          </p>
        </>
      )}
    </div>
  );
}

export function FeeCalculator({ funds }: { funds: CalculatorFund[] }) {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [firstTicker, setFirstTicker] = useState(funds[0].ticker);
  const [secondTicker, setSecondTicker] = useState(funds[1]?.ticker ?? "");

  const inputs: CalculatorInputs = {
    initialDeposit: parseDecimalInput(values.initialDeposit),
    monthlyContribution: parseDecimalInput(values.monthlyContribution),
    years: parseDecimalInput(values.years),
    annualReturnPct: parseDecimalInput(values.annualReturnPct),
  };

  const selected = [firstTicker, secondTicker]
    .map((ticker) => funds.find((fund) => fund.ticker === ticker))
    .filter((fund): fund is CalculatorFund => fund !== undefined);

  const inputIssues = validateInputs(inputs);
  const outcomes = selected.map((fund) => ({
    fund,
    outcome: calculateFeeImpact(inputs, fund.expenseRatio),
  }));
  const rows: FundResult[] = outcomes.flatMap(({ fund, outcome }) =>
    outcome.ok ? [{ fund, result: outcome.result }] : [],
  );
  const calculable = rows.length === selected.length && rows.length > 0;
  const formIssue =
    inputIssues.find((issue) => issue.field === "form") ??
    outcomes
      .flatMap(({ outcome }) => (outcome.ok ? [] : outcome.issues))
      .find((issue) => issue.field === "form" || issue.field === "expenseRatio");

  const issueFor = (field: InputField) => inputIssues.find((issue) => issue.field === field);
  // Only the fact that the calculator was used is recorded, never the inputs.
  const setValue = (field: InputField) => (value: string) => {
    trackOnce("calculator_used");
    setValues((current) => ({ ...current, [field]: value }));
  };

  const chooseFirst = (ticker: string) => {
    trackOnce("calculator_used");
    setFirstTicker(ticker);
    if (ticker === secondTicker) setSecondTicker("");
  };

  return (
    <div className="grid overflow-hidden rounded-panel border border-ink-line bg-card shadow-[0_40px_80px_-50px_rgb(17_18_16/0.6)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr]">
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        aria-label="Vstupy kalkulačky poplatků"
        className="grid grid-cols-2 content-start gap-x-3 gap-y-5 p-5 md:p-8 lg:col-start-1 lg:row-start-1"
      >
        <div className="col-span-2 hidden sm:block">
          <p className="label-mono text-muted">Vaše předpoklady</p>
          <h3 className="font-display mt-2 text-display-s font-bold">Nastavte vklad a horizont</h3>
        </div>
        <NumberField
          field="initialDeposit"
          label="Počáteční vklad"
          value={values.initialDeposit}
          issue={issueFor("initialDeposit")}
          onChange={setValue("initialDeposit")}
        />
        <NumberField
          field="monthlyContribution"
          label="Měsíční příspěvek"
          value={values.monthlyContribution}
          issue={issueFor("monthlyContribution")}
          onChange={setValue("monthlyContribution")}
        />
        <NumberField
          field="years"
          label="Horizont"
          value={values.years}
          issue={issueFor("years")}
          onChange={setValue("years")}
        />
        <NumberField
          field="annualReturnPct"
          label="Roční výnos"
          value={values.annualReturnPct}
          issue={issueFor("annualReturnPct")}
          onChange={setValue("annualReturnPct")}
        />
        <p className="col-span-2 -mt-1 text-xs leading-relaxed text-muted">
          Výchozí hodnoty jsou jen ilustrativní a můžete je změnit. Roční výnos je váš vlastní
          předpoklad před náklady fondu, ne prognóza ani očekávaný výnos.
        </p>
        <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-5 border-t border-line pt-5">
          <FundSelect label="Fond" value={firstTicker} funds={funds} onChange={chooseFirst} />
          <FundSelect
            label="Porovnat s"
            value={secondTicker}
            funds={funds.filter((fund) => fund.ticker !== firstTicker)}
            emptyLabel="Bez srovnání"
            onChange={(ticker) => {
              trackOnce("calculator_used");
              setSecondTicker(ticker);
            }}
          />
        </div>
      </form>

      <div
        aria-live="polite"
        className="on-ink bg-ink-raised p-5 md:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-display-s font-bold">Modelový výsledek</h3>
          <p className="label-mono text-ink-muted">Odhad, ne předpověď</p>
        </div>
        <div className="mt-5">
          {calculable ? (
            <Results rows={rows} />
          ) : (
            <p className="flex gap-3 rounded-2xl border border-danger-on-ink/60 p-4 text-sm">
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-danger-on-ink text-xs font-bold text-ink"
              >
                !
              </span>
              {formIssue ? formMessage(formIssue.code) : "Výsledek se zobrazí po opravě vstupů."}
            </p>
          )}
        </div>

        {strategiesDiffer(selected) && (
          <p className="mt-4 grid grid-cols-[0.375rem_1fr] gap-3 rounded-2xl border border-ink-line p-4 text-sm leading-relaxed">
            <span aria-hidden="true" className="hatch rounded-full text-lime" />
            <span>
              <strong className="font-semibold text-lime">Odlišná strategie.</strong> Vybrané
              fondy nesledují stejně vážený index. Kalkulačka pro oba používá stejný předpokládaný
              výnos jen proto, aby ukázala vliv TER. Neznamená to, že fondy ve skutečnosti dosáhnou
              stejného výnosu.
            </span>
          </p>
        )}

      </div>

      <div className="px-5 pb-6 pt-6 md:px-8 md:pb-8 lg:col-start-1 lg:row-start-2 lg:pt-0">
        <div className="lg:border-t lg:border-line lg:pt-5">
          <p className="label-mono text-muted">Jak model počítá</p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <li>
              Zjednodušený model: stálý roční výnos, měsíční úročení, příspěvky na konci měsíce.
            </li>
            <li>
              Výsledek je odhad rozdílu konečné hodnoty, ne přesný součet skutečně zaplacených
              poplatků, a není zárukou výnosu.
            </li>
            <li>
              Nezahrnuje daně, poplatky brokera, spready ani převod měn a pohyb kurzu. Částky v Kč
              jsou jen jednotkou modelu.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
