import Link from "next/link";
import { etfs } from "@/data/etfs";
import { EtfComparison } from "@/components/EtfComparison";
import { FeeCalculator } from "@/components/FeeCalculator";
import { LeadForm } from "@/components/LeadForm";
import { isEqualWeight, snapshotDate, toCalculatorFund } from "@/lib/etf-view";
import { formatDate, formatPercent } from "@/lib/format";

export type LandingVariant = "compare" | "fees";

interface HeroContent {
  eyebrow: string;
  headline: string;
  text: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

// Headline, text and primary CTA mirror the ad for each route; see docs/ad-copy.md.
const HERO: Record<LandingVariant, HeroContent> = {
  compare: {
    eyebrow: "Srovnání ETF kotovaných v USA",
    headline: "Americká ETF v jedné tabulce",
    text: "Porovnejte poplatky, burzu a dostupnost vybraných amerických ETF. Česky a s odkazy na zdroje.",
    primary: { label: "Zobrazit srovnání", href: "#srovnani" },
    secondary: { label: "Spočítat poplatky", href: "#kalkulacka" },
  },
  fees: {
    eyebrow: "Kalkulačka poplatků ETF",
    headline: "Kolik vás stojí poplatky ETF za 20 let?",
    text: "Zadejte vklad a horizont. Kalkulačka ukáže, jak se poplatky mohou projevit na konečné hodnotě investice.",
    primary: { label: "Spočítat poplatky", href: "#kalkulacka" },
    secondary: { label: "Zobrazit srovnání", href: "#srovnani" },
  },
};

const NAV_LINKS = [
  { label: "Srovnání", href: "#srovnani" },
  { label: "Kalkulačka", href: "#kalkulacka" },
  { label: "Průvodce", href: "#pruvodce" },
];

function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Americká ETF
        </Link>
        <nav aria-label="Hlavní navigace">
          <ul className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link, index) => (
              <li key={link.href} className={index === 2 ? "hidden sm:block" : undefined}>
                <a
                  href={link.href}
                  className="inline-flex h-11 items-center rounded-md px-2.5 text-muted hover:bg-surface hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Hero({ variant }: { variant: LandingVariant }) {
  const content = HERO[variant];
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-accent">{content.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {content.headline}
      </h1>
      <p className="mt-3 text-base text-muted md:text-lg">{content.text}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          href={content.primary.href}
          className="inline-flex h-12 items-center rounded-md bg-accent px-5 text-base font-semibold text-white hover:bg-accent-strong"
        >
          {content.primary.label}
        </a>
        <a
          href={content.secondary.href}
          className="inline-flex h-11 items-center font-medium text-accent underline underline-offset-4 hover:text-accent-strong"
        >
          {content.secondary.label}
        </a>
      </div>
    </div>
  );
}

/** Compact fee overview shown in the first viewport of the comparison variant. */
function ComparisonPreview() {
  return (
    <div className="rounded-lg border border-line bg-background">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Roční náklady fondů (TER)</h2>
        <p className="text-xs text-muted">k {formatDate(snapshotDate(etfs))}</p>
      </div>
      <ul>
        {etfs.map((etf) => (
          <li
            key={etf.ticker}
            className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="font-semibold">{etf.ticker}</p>
              <p className="truncate text-xs text-muted">
                {isEqualWeight(etf)
                  ? "Rovnoměrně vážený index · odlišná strategie"
                  : etf.indexName.value}
              </p>
            </div>
            <p className="shrink-0 text-base font-semibold tabular-nums">
              {formatPercent(etf.expenseRatioPercentPerYear.value)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalculatorSection({ withHeading }: { withHeading: boolean }) {
  return (
    <section
      id="kalkulacka"
      aria-labelledby={withHeading ? "kalkulacka-heading" : undefined}
      aria-label={withHeading ? undefined : "Kalkulačka poplatků"}
      className={withHeading ? "bg-surface py-12 md:py-16" : "pb-12 md:pb-16"}
    >
      <div className="mx-auto w-full max-w-5xl px-4">
        {withHeading && (
          <>
            <h2
              id="kalkulacka-heading"
              className="text-2xl font-semibold tracking-tight md:text-3xl"
            >
              Kalkulačka poplatků
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Modelový odhad, jak se roční náklady fondu (TER) mohou projevit na konečné hodnotě
              investice. Horizont i ostatní předpoklady si nastavte podle sebe.
            </p>
          </>
        )}
        <div
          className={`rounded-lg border border-line bg-background p-4 md:p-6 ${
            withHeading ? "mt-6" : ""
          }`}
        >
          <FeeCalculator funds={etfs.map(toCalculatorFund)} />
        </div>
      </div>
    </section>
  );
}

function AvailabilitySection() {
  return (
    <section
      id="dostupnost"
      aria-labelledby="dostupnost-heading"
      className="border-t border-line py-12 md:py-16"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 md:grid-cols-2">
        <div>
          <h2 id="dostupnost-heading" className="text-2xl font-semibold tracking-tight">
            Dostupnost pro investory z EU
          </h2>
          <p className="mt-3 text-muted">
            Nabídka investičních produktů neprofesionálním investorům v EU se řídí nařízením
            PRIIPs, které počítá se sdělením klíčových informací (KID). Zda je KID u konkrétního
            fondu k dispozici, jsme v tomto srovnání <strong>neověřovali</strong>, a proto to u
            žádného fondu netvrdíme ani nevylučujeme.
          </p>
          <p className="mt-3 text-muted">
            Jestli a jak můžete daný fond koupit, záleží na vašem brokerovi a na oficiálních
            dokumentech fondu. Ověřte si to u nich dřív, než se rozhodnete.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Metodika a aktuálnost</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              Údaje přebíráme z dokumentů správců fondů: stránek fondů, přehledů a prospektů.
              Odkazy najdete u každého fondu.
            </li>
            <li>
              Jde o ručně udržovaný přehled ověřený k {formatDate(snapshotDate(etfs))}, ne o živá
              tržní data. Poplatky se mohou změnit.
            </li>
            <li>
              Co se nepodařilo ověřit z oficiálního zdroje, označujeme jako neověřené a
              neodhadujeme to.
            </li>
            <li>Neuvádíme výkonnost fondů, objem majetku ani žádné pořadí.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function GuideSection() {
  return (
    <section id="pruvodce" aria-labelledby="pruvodce-heading" className="bg-surface py-12 md:py-16">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-accent">Připravujeme · zdarma</p>
          <h2 id="pruvodce-heading" className="mt-2 text-2xl font-semibold tracking-tight">
            Průvodce americkými ETF pro české investory
          </h2>
          <p className="mt-3 text-muted">Bezplatný průvodce ve formátu PDF bude obsahovat:</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Rozšířené srovnání ETF s odkazy na zdroje.</li>
            <li>
              Vysvětlení PRIIPs a KID a toho, proč je dostupnost fondu potřeba ověřit, ne
              předpokládat.
            </li>
            <li>Praktický kontrolní seznam pro výběr ETF.</li>
          </ol>
        </div>
        <div className="rounded-lg border border-line bg-background p-4 md:p-6">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line py-10 text-sm">
      <div className="mx-auto w-full max-w-5xl px-4">
        <nav aria-label="Navigace v patičce">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/" className="inline-flex h-11 items-center underline underline-offset-4">
                Srovnání ETF
              </Link>
            </li>
            <li>
              <Link
                href="/poplatky"
                className="inline-flex h-11 items-center underline underline-offset-4"
              >
                Kalkulačka poplatků
              </Link>
            </li>
            <li>
              <a
                href="#dostupnost"
                className="inline-flex h-11 items-center underline underline-offset-4"
              >
                Dostupnost a metodika
              </a>
            </li>
          </ul>
        </nav>
        <p className="mt-4 max-w-3xl text-muted">
          Tento web má pouze vzdělávací charakter. Nejde o investiční, daňové ani právní
          poradenství ani o doporučení koupit či prodat konkrétní investiční nástroj. Investování
          je spojeno s rizikem a hodnota investice může klesat i růst.
        </p>
        <p className="mt-2 text-muted">
          Údaje o fondech ověřeny k {formatDate(snapshotDate(etfs))}. Nejde o živá tržní data.
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Přeskočit na obsah
      </a>
      <SiteHeader />
      <main id="obsah" data-variant={variant} className="flex-1">
        {variant === "compare" ? (
          <>
            <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 pb-4 pt-8 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-10 md:pt-14">
              <Hero variant={variant} />
              <ComparisonPreview />
            </div>
            <EtfComparison funds={etfs} />
            <CalculatorSection withHeading />
          </>
        ) : (
          <>
            <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-8 md:pt-14">
              <Hero variant={variant} />
            </div>
            <CalculatorSection withHeading={false} />
            <div className="border-t border-line">
              <EtfComparison funds={etfs} />
            </div>
          </>
        )}
        <AvailabilitySection />
        <GuideSection />
      </main>
      <SiteFooter />
    </>
  );
}
