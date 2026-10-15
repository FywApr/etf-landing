import Link from "next/link";
import type { ReactNode } from "react";
import { etfs, isVerified } from "@/data/etfs";
import { TrackedLink } from "@/components/Analytics";
import { ArrowIcon, BrandMark, Wordmark } from "@/components/Brand";
import { EtfComparison } from "@/components/EtfComparison";
import { FeeCalculator } from "@/components/FeeCalculator";
import { LeadForm } from "@/components/LeadForm";
import { SectionHeading } from "@/components/SectionHeading";
import { TerBar } from "@/components/TerBar";
import {
  EQUAL_WEIGHT_LABEL,
  UNVERIFIED_LABEL,
  groupByWeighting,
  isEqualWeight,
  snapshotDate,
  terScaleMax,
  toCalculatorFund,
  weightingLabels,
} from "@/lib/etf-view";
import type { CTA_TARGETS } from "@/lib/analytics/events";
import { czechPlural, formatDate, formatPercent } from "@/lib/format";
import { GUIDE_SECTIONS, GUIDE_TITLE } from "@/lib/guide/contents";

export type LandingVariant = "compare" | "fees";

type CtaTarget = (typeof CTA_TARGETS)[number];

interface SectionLink {
  label: string;
  href: string;
  target: CtaTarget;
}

interface HeroContent {
  eyebrow: string;
  /** The headline split around the words that get the lime underline. */
  headline: [before: string, marked: string, after: string];
  text: string;
  primary: SectionLink;
  secondary: SectionLink;
}

// Headline, text and primary CTA mirror the ad for each route; see docs/ad-copy.md.
const HERO: Record<LandingVariant, HeroContent> = {
  compare: {
    eyebrow: "Srovnání ETF kotovaných v USA",
    headline: ["Americká ETF v jedné ", "tabulce", ""],
    text: "Porovnejte poplatky, burzu a dostupnost vybraných amerických ETF. Česky a s odkazy na zdroje.",
    primary: { label: "Zobrazit srovnání", href: "#srovnani", target: "comparison" },
    secondary: { label: "Spočítat poplatky", href: "#kalkulacka", target: "calculator" },
  },
  fees: {
    eyebrow: "Kalkulačka poplatků ETF",
    headline: ["Kolik vás stojí poplatky ETF za ", "20 let", "?"],
    text: "Zadejte vklad a horizont. Kalkulačka ukáže, jak se poplatky mohou projevit na konečné hodnotě investice.",
    primary: { label: "Spočítat poplatky", href: "#kalkulacka", target: "calculator" },
    secondary: { label: "Zobrazit srovnání", href: "#srovnani", target: "comparison" },
  },
};

const NAV_LINKS: SectionLink[] = [
  { label: "Srovnání", href: "#srovnani", target: "comparison" },
  { label: "Kalkulačka", href: "#kalkulacka", target: "calculator" },
];

const SNAPSHOT = formatDate(snapshotDate(etfs));
const SOURCE_COUNT = etfs.reduce((count, etf) => count + etf.sources.length, 0);
const FUND_COUNT_LABEL = `${etfs.length} ${czechPlural(etfs.length, "fond", "fondy", "fondů")}`;
const SOURCE_COUNT_LABEL = `${SOURCE_COUNT} ${czechPlural(SOURCE_COUNT, "oficiální zdroj", "oficiální zdroje", "oficiálních zdrojů")}`;

const container = "mx-auto w-full max-w-6xl px-4 md:px-6";

function SiteHeader() {
  const navLink =
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-sm text-ink-muted transition-colors hover:text-paper md:flex-none";
  return (
    <header className="on-ink bg-ink">
      <div className={`${container} flex flex-wrap items-center justify-between gap-x-6 pt-3 md:py-4`}>
        <Wordmark />
        <nav
          aria-label="Hlavní navigace"
          className="order-last -mx-4 mt-2 w-[calc(100%+2rem)] border-t border-ink-line px-2 md:order-none md:mx-0 md:ml-auto md:mt-0 md:w-auto md:border-0 md:px-0"
        >
          <ul className="flex items-center md:gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href} className="flex flex-1 md:flex-none">
                <TrackedLink
                  href={link.href}
                  placement="header_nav"
                  target={link.target}
                  className={navLink}
                >
                  {link.label}
                </TrackedLink>
              </li>
            ))}
            <li className="flex flex-1 md:flex-none">
              <a href="#metodika" className={navLink}>
                Metodika
              </a>
            </li>
          </ul>
        </nav>
        <TrackedLink
          href="#pruvodce"
          placement="header_nav"
          target="guide"
          className="btn-lime min-h-11 px-4 text-sm"
        >
          Průvodce zdarma
        </TrackedLink>
      </div>
    </header>
  );
}

function HeroCopy({ variant, facts }: { variant: LandingVariant; facts: string[] }) {
  const content = HERO[variant];
  const [before, marked, after] = content.headline;
  return (
    <div>
      <p className="label-mono flex items-center gap-2 text-lime">
        <span aria-hidden="true" className="size-2 rounded-[2px] bg-lime" />
        {content.eyebrow}
      </p>
      <h1 className="font-display mt-5 text-display-l font-bold text-balance">
        {before}
        <span className="relative whitespace-nowrap">
          <span className="relative z-10">{marked}</span>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-[0.06em] h-[0.16em] rounded-full bg-lime"
          />
        </span>
        {after}
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted md:text-xl">
        {content.text}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <TrackedLink
          href={content.primary.href}
          placement="hero_primary"
          target={content.primary.target}
          className="btn-lime min-h-13 px-6 text-base"
        >
          {content.primary.label}
          <ArrowIcon />
        </TrackedLink>
        <TrackedLink
          href={content.secondary.href}
          placement="hero_secondary"
          target={content.secondary.target}
          // On small phones the fees variant drops this link (the header nav has it)
          // so the calculator itself reaches the first viewport.
          className={`link min-h-11 items-center font-medium decoration-lime ${
            variant === "fees" ? "hidden sm:inline-flex" : "inline-flex"
          }`}
        >
          {content.secondary.label}
        </TrackedLink>
      </div>
      <ul className="label-mono mt-10 hidden flex-wrap gap-x-5 gap-y-2 border-t border-ink-line pt-5 text-ink-muted sm:flex">
        {facts.map((fact) => (
          <li key={fact} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-1 rounded-full bg-ink-muted" />
            {fact}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupLabel({ equalWeight, tone }: { equalWeight: boolean; tone: "ink" | "paper" }) {
  const swatch = tone === "ink" ? "text-lime" : "text-ink";
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-2.5 w-4 shrink-0 rounded-[2px] ${swatch} ${
          equalWeight ? "hatch ring-1 ring-current ring-inset" : "bg-current"
        }`}
      />
      {equalWeight
        ? EQUAL_WEIGHT_LABEL
        : `S&P 500 · ${weightingLabels["float-adjusted-market-cap"].toLowerCase()}`}
    </span>
  );
}

/** First-viewport fee overview of the comparison variant. All values from data/etfs.ts. */
function TerPanel() {
  const scaleMax = terScaleMax(etfs);
  let row = 0;
  return (
    <figure className="on-ink rounded-panel border border-ink-line bg-ink-raised p-5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)] md:p-7">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold">Roční náklady fondů (TER)</span>
        <span className="label-mono whitespace-nowrap text-ink-muted">k {SNAPSHOT}</span>
      </figcaption>
      {groupByWeighting(etfs).map((group) => (
        <div key={group.weighting} className="mt-5">
          <p className="label-mono text-ink-muted">
            <GroupLabel equalWeight={group.weighting === "equal"} tone="ink" />
          </p>
          <ul className="mt-1 divide-y divide-ink-line">
            {group.funds.map((etf) => (
              <li key={etf.ticker} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="min-w-0">
                    <span className="text-lg font-semibold">{etf.ticker}</span>
                    <span className="block text-xs text-ink-muted sm:ml-2 sm:inline sm:text-sm">
                      {etf.issuer}
                    </span>
                  </p>
                  <p className="num shrink-0 text-xl font-semibold">
                    {formatPercent(etf.expenseRatioPercentPerYear.value)}
                  </p>
                </div>
                <div className="mt-2.5">
                  <TerBar
                    valuePct={etf.expenseRatioPercentPerYear.value}
                    scaleMax={scaleMax}
                    equalWeight={isEqualWeight(etf)}
                    tone="ink"
                    delayMs={120 + row++ * 70}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div aria-hidden="true" className="label-mono mt-3 flex justify-between text-ink-muted">
        <span>0 %</span>
        <span>{formatPercent(scaleMax)}</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        Délka pruhu odpovídá ročnímu TER na lineárním měřítku od nuly do {formatPercent(scaleMax)}.
        Neukazuje výkonnost ani pořadí fondů.
      </p>
    </figure>
  );
}

function CompareHero() {
  return (
    <section aria-label="Úvod" className="on-ink relative overflow-hidden bg-ink">
      <div
        aria-hidden="true"
        className="ruled-ink absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div
        className={`${container} relative grid gap-10 pb-16 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pb-24 lg:pt-16`}
      >
        <HeroCopy
          variant="compare"
          facts={[FUND_COUNT_LABEL, `Údaje k ${SNAPSHOT}`, SOURCE_COUNT_LABEL]}
        />
        <TerPanel />
      </div>
    </section>
  );
}

function FeesHero() {
  return (
    <section aria-label="Úvod" className="on-ink relative overflow-hidden bg-ink">
      <div
        aria-hidden="true"
        className="ruled-ink absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
      />
      <div className={`${container} relative pb-24 pt-8 sm:pb-28 lg:pt-12`}>
        <HeroCopy
          variant="fees"
          facts={[
            `${FUND_COUNT_LABEL} v kalkulačce`,
            `TER k ${SNAPSHOT}`,
            "Počítá se ve vašem prohlížeči",
          ]}
        />
      </div>
    </section>
  );
}

function CalculatorSection({ variant }: { variant: LandingVariant }) {
  const calculator = <FeeCalculator funds={etfs.map(toCalculatorFund)} />;

  if (variant === "fees") {
    // The calculator overlaps the dark hero so it starts inside the first viewport.
    return (
      <section id="kalkulacka" aria-labelledby="kalkulacka-heading" className="pb-16 md:pb-24">
        {/* Keeps the outline h1 → h2 → h3 without adding a visible heading. */}
        <h2 id="kalkulacka-heading" className="sr-only">
          Kalkulačka poplatků
        </h2>
        <div className={`${container} relative z-10 -mt-20`}>{calculator}</div>
      </section>
    );
  }

  return (
    <section
      id="kalkulacka"
      aria-labelledby="kalkulacka-heading"
      className="bg-paper-deep py-16 md:py-24"
    >
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <SectionHeading id="kalkulacka-heading" eyebrow="Kalkulačka" title="Kalkulačka poplatků">
            <p>
              Modelový odhad, jak se roční náklady fondu (TER) mohou projevit na konečné hodnotě
              investice. Horizont i ostatní předpoklady si nastavte podle sebe.
            </p>
          </SectionHeading>
          <Link href="/poplatky" className="link inline-flex min-h-11 items-center gap-2 font-medium">
            Samostatná kalkulačka
            <ArrowIcon direction="right" />
          </Link>
        </div>
        <div className="mt-10">{calculator}</div>
      </div>
    </section>
  );
}

function KidStatusBoard() {
  return (
    <div className="on-ink rounded-panel bg-ink p-5 md:p-7">
      <p className="label-mono text-ink-muted">Sdělení klíčových informací (KID) podle PRIIPs</p>
      <ul className="mt-3 divide-y divide-ink-line">
        {etfs.map((etf) => (
          <li key={etf.ticker} className="flex min-h-12 items-center justify-between gap-4 py-2">
            <span className="font-semibold">{etf.ticker}</span>
            {isVerified(etf.priipsKidAvailable) ? (
              <span>{etf.priipsKidAvailable.value ? "K dispozici" : "Není k dispozici"}</span>
            ) : (
              <span className="rounded-md border border-dashed border-ink-line-strong px-2 py-0.5 text-sm text-ink-muted">
                {UNVERIFIED_LABEL}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        „{UNVERIFIED_LABEL}“ znamená, že jsme dostupnost KID nezjišťovali. Neříká, zda KID
        existuje, nebo chybí.
      </p>
    </div>
  );
}

function AvailabilitySection() {
  return (
    <section id="dostupnost" aria-labelledby="dostupnost-heading" className="py-16 md:py-24">
      <div className={`${container} grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16`}>
        <SectionHeading
          id="dostupnost-heading"
          eyebrow="PRIIPs a KID"
          title="Dostupnost pro investory z EU"
        >
          <p>
            Nabídka investičních produktů neprofesionálním investorům v EU se řídí nařízením
            PRIIPs, které počítá se sdělením klíčových informací (KID). Zda je KID u konkrétního
            fondu k dispozici, jsme v tomto srovnání{" "}
            <strong className="font-semibold text-ink">neověřovali</strong>, a proto to u žádného
            fondu netvrdíme ani nevylučujeme.
          </p>
          <p className="mt-4">
            Jestli a jak můžete daný fond koupit, záleží na vašem brokerovi a na oficiálních
            dokumentech fondu. Ověřte si to u nich dřív, než se rozhodnete.
          </p>
        </SectionHeading>
        <KidStatusBoard />
      </div>
    </section>
  );
}

function MethodologySection() {
  const facts: { label: string; value: string }[] = [
    { label: "Ověřeno k", value: SNAPSHOT },
    { label: "Fondů v přehledu", value: String(etfs.length) },
    { label: "Oficiálních zdrojů", value: String(SOURCE_COUNT) },
  ];
  const points = [
    "Údaje přebíráme z dokumentů správců fondů: stránek fondů, přehledů a prospektů. Odkazy najdete u každého fondu.",
    `Jde o ručně udržovaný přehled ověřený k ${SNAPSHOT}, ne o živá tržní data. Poplatky se mohou změnit.`,
    "Co se nepodařilo ověřit z oficiálního zdroje, označujeme jako neověřené a neodhadujeme to.",
    "Neuvádíme výkonnost fondů, objem majetku ani žádné pořadí.",
  ];
  return (
    <section
      id="metodika"
      aria-labelledby="metodika-heading"
      className="border-t border-line bg-paper pb-16 pt-16 md:pb-24 md:pt-24"
    >
      <div className={container}>
        <SectionHeading id="metodika-heading" eyebrow="Metodika" title="Metodika a aktuálnost" />
        <dl className="mt-10 grid grid-cols-2 border-y border-ink sm:grid-cols-3">
          {facts.map((fact, index) => (
            <div
              key={fact.label}
              className={
                [
                  "col-span-2 py-5 sm:col-span-1 sm:pr-6",
                  "border-t border-line py-5 pr-4 sm:border-l sm:border-t-0 sm:px-6",
                  "border-l border-t border-line py-5 pl-4 sm:border-t-0 sm:px-6",
                ][index]
              }
            >
              <dt className="label-mono text-muted">{fact.label}</dt>
              <dd className="font-display num mt-2 text-display-s font-bold">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <ol className="mt-10 grid gap-x-12 gap-y-6 md:grid-cols-2">
          {points.map((point, index) => (
            <li key={point} className="grid grid-cols-[2.25rem_1fr] gap-2">
              <span aria-hidden="true" className="label-mono pt-1 text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="leading-relaxed">{point}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** HTML preview of the PDF: its real title and section headings, nothing more. */
function GuideCover() {
  return (
    <div className="relative mx-auto w-full max-w-[22rem] pb-4 pr-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 left-4 top-4 rotate-3 rounded-2xl border border-ink-line bg-ink-raised"
      />
      <figure
        aria-label="Náhled obsahu průvodce"
        className="relative flex aspect-[1/1.414] -rotate-[1.5deg] flex-col rounded-2xl bg-paper p-6 text-ink shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] sm:p-7"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <BrandMark className="size-6" />
            Americká ETF
          </span>
          <span className="label-mono rounded-full bg-ink px-2.5 py-1 text-lime">PDF</span>
        </div>
        <p className="font-display mt-8 text-[1.75rem] font-bold leading-[1.05] text-balance">
          {GUIDE_TITLE}
        </p>
        <div aria-hidden="true" className="mt-5 h-1.5 w-14 rounded-full bg-ink" />
        <figcaption className="label-mono mt-auto text-muted">Obsah</figcaption>
        <ol className="mt-2 divide-y divide-line border-t border-line text-sm">
          {Object.values(GUIDE_SECTIONS).map((title) => (
            <li key={title} className="py-1.5">
              {title}
            </li>
          ))}
        </ol>
        <p className="label-mono mt-4 text-muted">Údaje ověřeny k {SNAPSHOT}</p>
      </figure>
    </div>
  );
}

function GuideSection() {
  return (
    <section
      id="pruvodce"
      aria-labelledby="pruvodce-heading"
      className="on-ink relative overflow-hidden bg-ink py-16 md:py-24"
    >
      <div
        aria-hidden="true"
        className="ruled-ink absolute inset-0 [mask-image:linear-gradient(to_top,black,transparent_70%)]"
      />
      <div
        className={`${container} relative grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-20`}
      >
        <div className="order-last lg:order-first">
          <GuideCover />
        </div>
        <div>
          <SectionHeading id="pruvodce-heading" eyebrow="Zdarma ke stažení · PDF" title={GUIDE_TITLE} tone="ink">
            <p>
              Rozšířené srovnání fondů s odkazy na zdroje, vysvětlení PRIIPs a KID a toho, proč je
              dostupnost fondu potřeba ověřit, ne předpokládat, a praktický kontrolní seznam pro
              výběr ETF.
            </p>
          </SectionHeading>
          <div className="mt-8 rounded-panel border border-ink-line bg-ink-raised p-5 md:p-7">
            <LeadForm />
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const className = "link inline-flex min-h-11 items-center";
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-paper-deep py-12 text-sm">
      <div className={container}>
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 border-b border-line pb-6">
          <Wordmark />
          <nav aria-label="Navigace v patičce">
            <ul className="flex flex-wrap gap-x-6">
              <li>
                <FooterLink href="/">Srovnání ETF</FooterLink>
              </li>
              <li>
                <FooterLink href="/poplatky">Kalkulačka poplatků</FooterLink>
              </li>
              <li>
                <FooterLink href="#dostupnost">Dostupnost a metodika</FooterLink>
              </li>
              <li>
                <FooterLink href="/ochrana-osobnich-udaju">Ochrana osobních údajů</FooterLink>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-6 max-w-3xl leading-relaxed text-muted">
          Tento web má pouze vzdělávací charakter. Nejde o investiční, daňové ani právní
          poradenství ani o doporučení koupit či prodat konkrétní investiční nástroj. Investování
          je spojeno s rizikem a hodnota investice může klesat i růst.
        </p>
        <p className="label-mono mt-4 text-muted">
          Údaje o fondech ověřeny k {SNAPSHOT}. Nejde o živá tržní data.
        </p>
      </div>
    </footer>
  );
}

export function LandingPage({ variant }: { variant: LandingVariant }) {
  return (
    <>
      <a
        href="#obsah"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-lime focus:px-3 focus:py-2 focus:text-ink"
      >
        Přeskočit na obsah
      </a>
      <SiteHeader />
      <main id="obsah" data-variant={variant} className="flex-1">
        {variant === "compare" ? (
          <>
            <CompareHero />
            <EtfComparison funds={etfs} />
            <CalculatorSection variant={variant} />
          </>
        ) : (
          <>
            <FeesHero />
            <CalculatorSection variant={variant} />
            <EtfComparison funds={etfs} />
          </>
        )}
        <AvailabilitySection />
        <MethodologySection />
        <GuideSection />
      </main>
      <SiteFooter />
    </>
  );
}
