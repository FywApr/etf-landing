// The PDF guide. All fund data comes from data/etfs.ts; nothing is restated here.

import path from "node:path";
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { isVerified, type Etf, type EtfSource, type MaybeVerified } from "@/data/etfs";
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
import { GUIDE_SECTIONS, GUIDE_TITLE } from "@/lib/guide/contents";

export { GUIDE_TITLE };

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

// Noto Sans (SIL Open Font License) is bundled because the renderer's built-in
// fonts cannot display Czech diacritics.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// The default hyphenation is English; never split Czech words.
Font.registerHyphenationCallback((word) => [word]);

const color = {
  text: "#171717",
  muted: "#52525b",
  line: "#dfe2e8",
  surface: "#f5f6f8",
  accent: "#0b5c4a",
  accentSoft: "#e6f2ee",
  warn: "#8a4b0b",
  warnSoft: "#fdf5e6",
  warnLine: "#ecd3a2",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Noto Sans",
    fontSize: 10,
    lineHeight: 1.45,
    color: color.text,
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },
  eyebrow: { fontSize: 9, color: color.accent, fontWeight: 700, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 },
  lead: { fontSize: 11.5, color: color.muted, marginBottom: 16 },
  h2: { fontSize: 15, fontWeight: 700, marginTop: 6, marginBottom: 8 },
  h3: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  paragraph: { marginBottom: 8 },
  muted: { color: color.muted },
  small: { fontSize: 8.5, color: color.muted },
  box: { backgroundColor: color.surface, borderRadius: 4, padding: 10, marginBottom: 12 },
  warnBox: {
    backgroundColor: color.warnSoft,
    borderWidth: 1,
    borderColor: color.warnLine,
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  warnTitle: { color: color.warn, fontWeight: 700, marginBottom: 2 },
  listItem: { flexDirection: "row", marginBottom: 5 },
  listMarker: { width: 16, color: color.accent, fontWeight: 700 },
  listText: { flex: 1 },
  table: { borderTopWidth: 1, borderColor: color.line, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: color.line, paddingVertical: 5 },
  headCell: { fontSize: 8, color: color.muted, fontWeight: 700 },
  cellTicker: { width: "12%", fontWeight: 700 },
  cellIndex: { width: "38%" },
  cellTer: { width: "16%", textAlign: "right", fontWeight: 700 },
  cellVenue: { width: "17%", paddingLeft: 12 },
  cellInception: { width: "17%" },
  card: { borderWidth: 1, borderColor: color.line, borderRadius: 4, padding: 12, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  cardTicker: { fontSize: 14, fontWeight: 700 },
  cardTer: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  fieldRow: { flexDirection: "row", marginBottom: 3 },
  fieldLabel: { width: "30%", color: color.muted },
  fieldValue: { width: "70%" },
  link: { color: color.accent, textDecoration: "underline" },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: color.accent,
    borderRadius: 2,
    marginRight: 8,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    // Offset from the top of an A4 page (842pt): "bottom" is mispositioned by
    // the renderer on pages whose content wraps.
    top: 806,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: color.muted,
  },
});

/** A verified value, or an explicit "unverified" marker. Never a guess. */
function fieldText<T>(field: MaybeVerified<T>, format: (value: T) => string): string {
  return isVerified(field) ? format(field.value) : UNVERIFIED_LABEL;
}

function sourceDates(source: EtfSource): string {
  const retrieved = `staženo ${formatDate(source.retrievedOn)}`;
  return source.documentDate
    ? `dokument z ${formatDate(source.documentDate)}, ${retrieved}`
    : retrieved;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.listItem}>
      <Text style={styles.listMarker}>•</Text>
      <Text style={styles.listText}>{children}</Text>
    </View>
  );
}

function OverviewTable({ funds }: { funds: Etf[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.cellTicker, styles.headCell]}>FOND</Text>
        <Text style={[styles.cellIndex, styles.headCell]}>SLEDOVANÝ INDEX</Text>
        <Text style={[styles.cellTer, styles.headCell]}>TER ROČNĚ</Text>
        <Text style={[styles.cellVenue, styles.headCell]}>BURZA</Text>
        <Text style={[styles.cellInception, styles.headCell]}>VZNIK</Text>
      </View>
      {funds.map((etf) => (
        <View key={etf.ticker} style={styles.row}>
          <Text style={styles.cellTicker}>{etf.ticker}</Text>
          <Text style={styles.cellIndex}>
            {etf.indexName.value}
            {isEqualWeight(etf) ? " (odlišná strategie)" : ""}
          </Text>
          <Text style={styles.cellTer}>{formatPercent(etf.expenseRatioPercentPerYear.value)}</Text>
          <Text style={styles.cellVenue}>{etf.listingVenue.value}</Text>
          <Text style={styles.cellInception}>{fieldText(etf.inceptionDate, formatDate)}</Text>
        </View>
      ))}
    </View>
  );
}

function FundCard({ etf }: { etf: Etf }) {
  const inceptionNote = isVerified(etf.inceptionDate) ? inceptionNotes[etf.ticker] : undefined;
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardHeader}>
        <View style={{ width: "68%" }}>
          <Text style={styles.cardTicker}>{etf.ticker}</Text>
          <Text style={styles.muted}>{etf.name.value}</Text>
        </View>
        <View style={{ width: "30%" }}>
          <Text style={[styles.small, { textAlign: "right" }]}>TER ročně</Text>
          <Text style={styles.cardTer}>{formatPercent(etf.expenseRatioPercentPerYear.value)}</Text>
        </View>
      </View>

      <Field label="Správce" value={etf.issuer} />
      <Field label="Sledovaný index" value={etf.indexName.value} />
      <Field label="Vážení indexu" value={weightingLabels[etf.indexWeighting.value]} />
      <Field
        label="TER platné k"
        value={formatDate(etf.expenseRatioPercentPerYear.asOf)}
      />
      <Field
        label="Burza"
        value={`${etf.listingVenue.value} (údaj k ${formatDate(etf.listingVenue.asOf)})`}
      />
      <Field label="Vznik fondu" value={fieldText(etf.inceptionDate, formatDate)} />
      <Field
        label="Domicil"
        value={`${domicileLabels[etf.domicile.value]} (ověřeno pouze na úrovni země)`}
      />
      <Field
        label="Výplata výnosů"
        value={fieldText(etf.distributionFrequency, (value) => distributionLabels[value])}
      />
      <Field
        label="KID podle PRIIPs"
        value={fieldText(etf.priipsKidAvailable, (available) =>
          available ? "K dispozici" : "Není k dispozici",
        )}
      />

      {isEqualWeight(etf) && (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Rovnoměrně vážený index — odlišná strategie</Text>
          <Text>
            Každá společnost má v indexu stejnou váhu. Ostatní fondy v průvodci sledují index
            S&P 500 vážený tržní kapitalizací, takže nejde o srovnání stejného indexu. Rozdílný
            poplatek sám o sobě neříká, který fond je lepší nebo horší.
          </Text>
          {inceptionNote && isVerified(etf.inceptionDate) && (
            <Text style={{ marginTop: 4 }}>
              Datum vzniku uvádí souhrnný prospekt z {formatDate(etf.inceptionDate.asOf)}.{" "}
              {inceptionNote}
            </Text>
          )}
        </View>
      )}

      <Text style={[styles.h3, { marginTop: 8 }]}>Oficiální zdroje</Text>
      {etf.sources.map((source) => (
        <Text key={source.id} style={{ marginBottom: 2 }}>
          <Link src={source.url} style={styles.link}>
            {sourceKindLabels[source.kind]}
          </Link>
          <Text style={styles.muted}>
            {" "}
            · {new URL(source.url).hostname} · {sourceDates(source)}
          </Text>
        </Text>
      ))}
    </View>
  );
}

const CHECKLIST = [
  "Jaký index fond sleduje a jak je vážený? Podobný název ještě neznamená stejnou strategii.",
  "Kolik činí roční náklady (TER) a ke kterému datu údaj platí?",
  "Na které burze je fond kotovaný a v jaké měně se obchoduje?",
  "Nabízí můj broker tento fond neprofesionálním klientům? Mám k dispozici KID a prospekt?",
  "Jak fond nakládá s výnosy, tedy zda je vyplácí, nebo reinvestuje, a jak často?",
  "Jaké náklady ponesu mimo TER: poplatky brokera, spready a měnovou konverzi?",
  "Jak se investice zdaňuje v mé situaci? Tento průvodce to neřeší; zeptejte se daňového poradce.",
  "Ověřil(a) jsem si údaje v aktuálních dokumentech správce? Odkazy jsou u každého fondu.",
];

function PageFooter({ snapshot }: { snapshot: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {GUIDE_TITLE} · údaje ověřeny k {snapshot}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Strana ${pageNumber} z ${totalPages}`} />
    </View>
  );
}

export function GuideDocument({ funds }: { funds: Etf[] }) {
  const snapshot = formatDate(snapshotDate(funds));

  return (
    <Document title={GUIDE_TITLE} language="cs" author="" subject="Vzdělávací přehled ETF">
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>VZDĚLÁVACÍ PRŮVODCE · ÚDAJE K {snapshot}</Text>
        <Text style={styles.title}>{GUIDE_TITLE}</Text>
        <Text style={styles.lead}>
          Rozšířené srovnání vybraných ETF kotovaných v USA, vysvětlení dostupnosti pro investory
          z EU a kontrolní seznam pro vlastní výběr.
        </Text>

        <View style={styles.box}>
          <Text style={styles.h3}>Než začnete číst</Text>
          <Text>
            Průvodce má pouze vzdělávací charakter. Není investičním, daňovým ani právním
            poradenstvím ani doporučením koupit či prodat konkrétní fond. Neuvádí výkonnost fondů
            a neslibuje žádný výnos. Údaje jsou ručně ověřený přehled k uvedenému datu, ne živá
            tržní data.
          </Text>
        </View>

        <Text style={styles.h2}>{GUIDE_SECTIONS.overview}</Text>
        <OverviewTable funds={funds} />
        <Text style={styles.small}>
          TER = celková roční nákladovost fondu v procentech hodnoty investice. Hodnota 0,03 %
          znamená tři setiny procenta ročně.
        </Text>

        <Text style={[styles.h2, { marginTop: 18 }]}>Co v průvodci najdete</Text>
        <Bullet>Rozšířené srovnání fondů s odkazy na oficiální zdroje a daty ověření.</Bullet>
        <Bullet>PRIIPs, KID a dostupnost pro investory z EU: co víme a co je potřeba ověřit.</Bullet>
        <Bullet>Praktický kontrolní seznam pro výběr a porovnání ETF.</Bullet>
        <Bullet>Metodiku, aktuálnost údajů a upozornění.</Bullet>
        <PageFooter snapshot={snapshot} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>{GUIDE_SECTIONS.comparison}</Text>
        <Text style={[styles.paragraph, styles.muted]}>
          Každý údaj pochází z dokumentu správce fondu. Co se z oficiálního zdroje ověřit
          nepodařilo, je označeno slovem „{UNVERIFIED_LABEL}“ a není odhadováno.
        </Text>
        {funds.map((etf) => (
          <FundCard key={etf.ticker} etf={etf} />
        ))}
        <PageFooter snapshot={snapshot} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>{GUIDE_SECTIONS.priips}</Text>
        <Text style={styles.paragraph}>
          Nařízení EU o produktech PRIIPs počítá s tím, že neprofesionální investor dostane před
          nákupem investičního produktu sdělení klíčových informací (KID). Zda je KID pro konkrétní
          fond kotovaný v USA k dispozici, se může u jednotlivých fondů lišit a v čase měnit.
        </Text>
        <Text style={styles.paragraph}>
          U žádného z fondů v tomto průvodci jsme dostupnost KID neověřovali. Proto neuvádíme, že
          KID existuje, ani že chybí.
        </Text>
        <View style={styles.box}>
          <Text style={styles.h3}>Co z toho plyne pro vás</Text>
          <Text>
            Jestli a jak můžete daný fond koupit, záleží na vašem brokerovi a na aktuálních
            oficiálních dokumentech fondu. Před nákupem si u brokera ověřte, zda fond nabízí
            klientům ve vaší kategorii, a vyžádejte si dokumenty, které k němu poskytuje.
          </Text>
        </View>

        <Text style={[styles.h2, { marginTop: 10 }]}>{GUIDE_SECTIONS.checklist}</Text>
        {CHECKLIST.map((item) => (
          <View key={item} style={styles.listItem} wrap={false}>
            <View style={styles.checkbox} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}

        <Text style={[styles.h2, { marginTop: 14 }]}>{GUIDE_SECTIONS.methodology}</Text>
        <Bullet>
          Údaje přebíráme z dokumentů správců fondů: stránek fondů, přehledů, prospektů a podání u
          americké Komise pro cenné papíry (SEC).
        </Bullet>
        <Bullet>
          {`Přehled byl ručně ověřen k ${snapshot}. Jednotlivé údaje mohou mít starší datum, které je uvedeno u každého fondu. Poplatky a další parametry se mohou změnit.`}
        </Bullet>
        <Bullet>
          Domicil fondu je ověřen pouze na úrovni země. Právní formu fondů průvodce neuvádí.
        </Bullet>
        <Bullet>
          Průvodce neuvádí výkonnost, objem majetku ani pořadí fondů a žádný fond nedoporučuje.
        </Bullet>
        <View style={[styles.box, { marginTop: 8 }]}>
          <Text>
            Investování je spojeno s rizikem a hodnota investice může klesat i růst. Před
            rozhodnutím si údaje ověřte v aktuálních dokumentech správce a u svého brokera.
          </Text>
        </View>
        <PageFooter snapshot={snapshot} />
      </Page>
    </Document>
  );
}
