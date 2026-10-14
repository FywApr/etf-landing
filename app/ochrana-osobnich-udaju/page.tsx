import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SimplePage } from "@/components/SimplePage";
import { getPrivacyConfig, type PrivacyConfig } from "@/lib/config";
import { MARKETING_CONSENT } from "@/lib/consent";
import { GUIDE_TOKEN_TTL_DAYS } from "@/lib/guide-token";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů",
  description: "Jak tento web zpracovává osobní údaje při žádosti o průvodce.",
};

const h2 = "mt-8 text-xl font-semibold tracking-tight";
const paragraph = "mt-3 text-muted";
const list = "mt-3 list-disc space-y-2 pl-5 text-muted";

// DRAFT WORDING. The legal bases, the retention period and the text as a whole
// must be confirmed by the actual data controller before launch; see
// docs/operations.md. Nothing here has had a legal review.
function Notice({ config }: { config: PrivacyConfig }) {
  const {
    controller,
    leadRetentionDays,
    consentedLeadRetentionDays,
    funnelEventRetentionDays,
    privacyNoticeVersion,
  } = config;
  return (
    <>
      <p className={paragraph}>
        Tato stránka popisuje, jaké osobní údaje zpracováváme, když si na tomto webu požádáte o
        průvodce, a proč.
      </p>

      <h2 className={h2}>Kdo je správcem údajů</h2>
      <p className={paragraph}>
        {controller.name}, {controller.address}. Kontakt:{" "}
        <a href={`mailto:${controller.email}`} className="underline underline-offset-2">
          {controller.email}
        </a>
        .
      </p>

      <h2 className={h2}>Proč chceme váš e-mail</h2>
      <p className={paragraph}>
        E-mail používáme k tomu, abychom evidovali vaši žádost o průvodce a zpřístupnili vám ho.
        Průvodce neposíláme e-mailem: po odeslání formuláře se zobrazí stránka, ze které si ho
        stáhnete. Přístup k němu zajišťuje technická cookie s náhodným přístupovým klíčem, kterou
        prohlížeč nemůže číst skriptem a která platí {GUIDE_TOKEN_TTL_DAYS} dní. U nás je uložen
        jen otisk tohoto klíče. Právním základem je vyřízení vaší žádosti.
      </p>

      <h2 className={h2}>Dobrovolný souhlas se zasíláním obsahu</h2>
      <p className={paragraph}>
        Ve formuláři můžete navíc zaškrtnout souhlas v tomto znění: „{MARKETING_CONSENT.text}“
        Souhlas není podmínkou pro získání průvodce. Pokud ho udělíte, uložíme si datum, čas a
        verzi jeho znění. Právním základem je váš souhlas.
      </p>
      <p className={paragraph}>
        Tento web v současnosti žádné marketingové e-maily neodesílá, protože k němu není připojena
        žádná služba pro jejich rozesílání.
      </p>

      <h2 className={h2}>Jaké údaje zpracováváme</h2>
      <ul className={list}>
        <li>E-mailovou adresu.</li>
        <li>Zda a kdy jste udělili souhlas se zasíláním obsahu a jeho verzi.</li>
        <li>
          Z které verze stránky a z jaké kampaně jste přišli (parametry utm) a náhodný
          identifikátor návštěvy.
        </li>
        <li>Otisk přístupového klíče k průvodci a datum jeho platnosti.</li>
      </ul>
      <p className={paragraph}>
        Na ochranu formuláře a stahování před zneužitím počítáme počet požadavků. Při provozu na
        hostingu Vercel k tomu z IP adresy vytváříme pomocí tajného klíče jednosměrný otisk; samotnou
        IP adresu neukládáme. Otisk není anonymní, protože po dobu uložení odlišuje jedno připojení
        od jiných, a mažeme ho nejpozději po 24 hodinách.
      </p>
      <p className={paragraph}>
        Pro měření návštěvnosti zaznamenáváme události o používání webu, například zobrazení
        stránky nebo použití kalkulačky, spolu s náhodným identifikátorem návštěvy. Neobsahují
        e-mail, hodnoty zadané do kalkulačky, IP adresu ani údaje o prohlížeči. Nepoužíváme k tomu
        cookies ani úložiště prohlížeče; identifikátor návštěvy existuje jen do opětovného načtení
        stránky. Pokud odešlete formulář, uložíme tento identifikátor i u vaší žádosti, takže
        události z této návštěvy lze propojit s vaším e-mailem. Tyto události proto nejsou
        anonymní.
      </p>

      <h2 className={h2}>Jak dlouho údaje uchováváme</h2>
      <ul className={list}>
        <li>
          Žádost bez souhlasu se zasíláním obsahu: nejdéle {leadRetentionDays} dní od poslední
          žádosti o průvodce.
        </li>
        <li>
          Žádost se souhlasem: nejdéle {consentedLeadRetentionDays} dní od poslední žádosti o
          průvodce. Opakovaná žádost o průvodce tuto lhůtu počítá znovu, souhlas ale neobnovuje.
          Pokud souhlas odvoláte, platí lhůta {leadRetentionDays} dní od poslední žádosti.
        </li>
        <li>Události o používání webu: nejdéle {funnelEventRetentionDays} dní od jejich zaznamenání.</li>
        <li>
          Přístup ke stažení průvodce přestává platit po {GUIDE_TOKEN_TTL_DAYS} dnech bez ohledu na
          uvedené lhůty.
        </li>
        <li>Počítadla požadavků na ochranu před zneužitím: nejdéle 24 hodin.</li>
      </ul>
      <p className={paragraph}>Po uplynutí lhůty údaje mažeme.</p>

      <h2 className={h2}>Vaše práva a odvolání souhlasu</h2>
      <p className={paragraph}>
        Souhlas můžete kdykoli odvolat a můžete požádat o přístup ke svým údajům, jejich opravu
        nebo výmaz. Napište na{" "}
        <a href={`mailto:${controller.email}`} className="underline underline-offset-2">
          {controller.email}
        </a>
        . Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů.
      </p>

      <p className="mt-8 text-sm text-muted">Verze zásad: {privacyNoticeVersion}</p>
    </>
  );
}

async function NoticeOrBlocker() {
  // Read the configuration per request, not at build time.
  await connection();
  const config = getPrivacyConfig();

  if (!config.ok) {
    return (
      <div className="mt-6 rounded-lg border border-warn-line bg-warn-soft p-4">
        <p className="font-semibold text-warn">Zásady zatím nejsou zveřejněny</p>
        <p className="mt-1">
          Provozovatel webu ještě nedoplnil své údaje. Dokud se tak nestane, formulář pro získání
          průvodce nepřijímá žádné e-maily a žádné osobní údaje neukládáme.
        </p>
      </div>
    );
  }
  return <Notice config={config.config} />;
}

export default function PrivacyPage() {
  return (
    <SimplePage>
      <h1 className="text-3xl font-semibold tracking-tight">Ochrana osobních údajů</h1>
      <Suspense fallback={<p className={paragraph}>Načítáme…</p>}>
        <NoticeOrBlocker />
      </Suspense>
    </SimplePage>
  );
}
