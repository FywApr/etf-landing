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
import { formatCzk, formatInteger, formatPercent, parseDecimalInput } from "@/lib/format";

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
      <div className="relative mt-1">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={issue ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`h-12 w-full rounded-md border bg-background pl-3 pr-11 text-base tabular-nums ${
            issue ? "border-danger" : "border-line"
          }`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted"
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
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
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
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-md border border-line bg-background px-2 text-base"
      >
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {funds.map((fund) => (
          <option key={fund.ticker} value={fund.ticker}>
            {fund.ticker} · TER {formatPercent(fund.expenseRatioPct)}
          </option>
        ))}
      </select>
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

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-surface p-3">
          <dt className="text-muted">Celkem vloženo</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums">
            {formatCzk(baseline.totalContributions)}
          </dd>
        </div>
        <div className="rounded-md bg-surface p-3">
          <dt className="text-muted">Hodnota při nulovém TER</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums">
            {formatCzk(baseline.zeroTerValue)}
          </dd>
        </div>
      </dl>

      <ul className="mt-3 grid gap-3">
        {rows.map(({ fund, result }) => (
          <li key={fund.ticker} className="rounded-md border border-line p-3">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="font-semibold">{fund.ticker}</h4>
              <p className="text-sm text-muted tabular-nums">
                TER {formatPercent(fund.expenseRatioPct)} ročně
              </p>
            </div>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Odhad konečné hodnoty po nákladech fondu</dt>
              <dd className="text-right font-semibold tabular-nums">
                {formatCzk(result.finalValue)}
              </dd>
              <dt className="text-muted">Rozdíl oproti nulovému TER</dt>
              <dd className="text-right font-semibold tabular-nums text-warn">
                −{formatCzk(result.feeCost)}
              </dd>
            </dl>
            <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-surface">
              <div
                className="h-1.5 rounded-full bg-warn"
                style={{
                  width: `${largestFeeCost > 0 ? (result.feeCost / largestFeeCost) * 100 : 0}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 2 && (
        <p className="mt-3 rounded-md bg-accent-soft p-3 text-sm">
          Rozdíl mezi {rows[0].fund.ticker} a {rows[1].fund.ticker} v tomto modelu:{" "}
          <strong className="tabular-nums">
            {formatCzk(Math.abs(rows[0].result.finalValue - rows[1].result.finalValue))}
          </strong>{" "}
          na konečné hodnotě. Vyplývá pouze z rozdílu TER při stejném předpokládaném výnosu.
        </p>
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
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        aria-label="Vstupy kalkulačky poplatků"
        className="grid grid-cols-2 content-start gap-x-3 gap-y-4"
      >
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
        <p className="col-span-2 -mt-2 text-xs text-muted">
          Výchozí hodnoty jsou jen ilustrativní a můžete je změnit. Roční výnos je váš vlastní
          předpoklad před náklady fondu, ne prognóza ani očekávaný výnos.
        </p>
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
      </form>

      <div aria-live="polite">
        <h3 className="text-lg font-semibold tracking-tight">Modelový výsledek</h3>
        <div className="mt-3">
          {calculable ? (
            <Results rows={rows} />
          ) : (
            <p className="rounded-md border border-line bg-surface p-3 text-sm">
              {formIssue ? formMessage(formIssue.code) : "Výsledek se zobrazí po opravě vstupů."}
            </p>
          )}
        </div>

        {strategiesDiffer(selected) && (
          <p className="mt-3 rounded-md border border-warn-line bg-warn-soft p-3 text-sm">
            <strong className="text-warn">Odlišná strategie.</strong> Vybrané fondy nesledují
            stejně vážený index. Kalkulačka pro oba používá stejný předpokládaný výnos jen proto,
            aby ukázala vliv TER. Neznamená to, že fondy ve skutečnosti dosáhnou stejného výnosu.
          </p>
        )}

        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
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
  );
}
