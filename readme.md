# Americká ETF pro české investory

Mobilní webová aplikace pro české drobné investory, kteří chtějí na jednom místě porovnat vybraná americká ETF, porozumět rozdílům mezi fondy a orientačně porovnat jejich nákladovost.

Hlavním cílem není doporučit „nejlepší ETF“, ale srozumitelně prezentovat ověřitelné informace, vysvětlit důležité rozdíly a nabídnout bezplatný PDF materiál **Průvodce americkými ETF pro české investory**. Projekt kombinuje produktové uvažování, implementaci webové aplikace, ověřování finančních údajů, měření konverzního funnelu a transparentně popsanou spolupráci s AI coding agentem.

> **Upozornění:** Projekt slouží pro vzdělávací a demonstrační účely. Neposkytuje individuální investiční, daňové ani právní poradenství. Finanční údaje je nutné posuzovat podle uvedených zdrojů a data jejich aktualizace.
> 

## Obsah

- Cíl produktu a hlavní funkce
- Sledovaná ETF a přesnost dat
- Technologie
- Vývoj webu: první a druhá verze
- Architektura a tok dat
- Proč byl zvolen tento postup vývoje
- Konverze a měření funnelu
- Dva koncepty prvního zobrazení a tři testovací hypotézy
- Spuštění lokálně
- Proměnné prostředí a databáze
- Testování a kontrola kvality
- Spolupráce s AI: pravidla, prompty a kontrola výsledků
- Zjištěné chyby, opravy a omezení
- Bezpečnost a soukromí
- Nasazení a aktuální stav
- Kontrolní seznam před vydáním

## Cíl produktu a hlavní funkce

### Srovnání ETF

Aplikace umožňuje porovnat pět vybraných ETF souvisejících s indexem S&P 500. Smyslem srovnání je zpřístupnit důležitá fakta v češtině, odlišit metodiku fondů a omezit nutnost hledat jednotlivé informace na několika místech. Finanční fakta mají být spravována v datové vrstvě, nikoliv znovu zapisována přímo do prezentačních komponent.

### Kalkulačka nákladovosti

Kalkulačka pomáhá porovnat dopad nákladovosti fondů na základě vstupů a výpočtové logiky aplikace. Výsledek je orientační výpočet, nikoliv předpověď budoucího výnosu ani záruka úspory. Rozhraní musí jasně popsat předpoklady a rozsah výpočtu.

### Bezplatný PDF průvodce a získávání leadů

Návštěvník může požádat o materiál **Průvodce americkými ETF pro české investory** prostřednictvím formuláře. Hlavní konverzí je úspěšné vyžádání průvodce. Tok zahrnuje validaci vstupu, uložení záznamu a vytvoření nebo bezpečné zpřístupnění PDF podle aktuální implementace.

### Analytický funnel

Měření má popsat cestu návštěvníka od zobrazení stránky přes interakce s porovnáním nebo kalkulačkou až po odeslání formuláře a zpřístupnění průvodce. Při úpravách UI je nutné zachovat skutečné názvy a kontrakty událostí definované v kódu. Nové události se nemají přidávat naslepo ani duplicitně.

### API, ochrana a retence dat

Projekt používá serverovou validaci a pro příslušné endpointy omezení četnosti požadavků (rate limiting). Byla také připravena logika denního úklidu dat podle retenčních pravidel. Její spolehlivý produkční provoz závisí na konfiguraci a plánování úloh v nasazeném prostředí.

## Sledovaná ETF a přesnost dat

| Ticker | Metodika vážení | Poznámka |
| --- | --- | --- |
| `SPY` | Podle tržní kapitalizace | Fond sledující index S&P 500 |
| `SPYM` | Podle tržní kapitalizace | Fond sledující index S&P 500 |
| `IVV` | Podle tržní kapitalizace | Fond sledující index S&P 500 |
| `VOO` | Podle tržní kapitalizace | Fond sledující index S&P 500 |
| `RSP` | Rovnoměrné vážení (equal-weight) | Odlišná metodika oproti ostatním čtyřem fondům |

**Důležitý rozdíl:** `SPY`, `SPYM`, `IVV` a `VOO` používají vážení podle tržní kapitalizace, zatímco `RSP` používá rovnoměrné vážení. `RSP` proto nelze prezentovat jako metodicky totožnou alternativu k ostatním fondům.

Pokud aplikace zobrazuje datum vzniku `RSP`, pracovně ověřená hodnota je **24. 4. 2003**. Místa obchodování se uvádějí podle zdroje; označení **NYSE Arca** se nesmí automaticky zaměňovat za jinou burzu.

Zdrojová sada je vedena v `data/etfs.ts` podle dokumentace současného vývojového zadání; před změnou vždy ověřte skutečné umístění dat v aktuální větvi. README záměrně neuvádí proměnlivé hodnoty nákladovosti, objemu majetku, cen nebo výkonnosti bez aktuálního zdroje a data měření.

Zásady práce s finančními údaji:

- nevymýšlet expense ratio, data vzniku, objem majetku, ceny, výnosy, obchodní místa, hodnocení ani žebříčky;
- nepoužívat náhodné hodnoty v grafech, fiktivní reference, vymyšlené počty uživatelů ani tvrzení o „nejlepším ETF“;
- pokud údaj nemá spolehlivý zdroj nebo datum měření, nezobrazovat jej jako aktuálně ověřenou hodnotu;
- při nalezení nesrovnalosti údaj opravit až po kontrole zdroje a zaznamenat důvod změny;
- historickou výkonnost, pokud se zobrazuje, doplnit konkrétním obdobím, zdrojem a kontextem; nevydávat ji za předpověď budoucnosti.

## Technologie

- **Next.js App Router** — webové rozhraní a serverové části aplikace.
- **TypeScript** — typová kontrola.
- **Tailwind CSS** — stylování a responzivní rozvržení.
- **Neon Postgres** — trvalé ukládání dat.
- **Zod** — validace dat a vstupů.
- **Vitest** — automatizované testy.
- **`@react-pdf/renderer`** — tvorba PDF materiálu.
- **Vercel** — zamýšlená cílová platforma nasazení.

Vizuální směr je prémiový, ale věcný fintech/editorial produkt: tmavé grafitové plochy, výrazná typografie, střídmé limetkové akcenty, přehledné finanční hodnoty a UI ilustrace odvozené od skutečných funkcí. Designová reference slouží jako inspirace pro úroveň zpracování, nikoliv jako předloha ke kopírování. Barva ani hierarchie prvků nesmí naznačovat, že určitý fond je automaticky doporučený nebo zaručeně výkonnější.

## Vývoj webu: první a druhá verze

Je důležité rozlišovat **dvě vývojové verze webu** a **dvě varianty hero sekce pro testování**. Nejde o totéž: druhá verze představuje redesign celé landing page, zatímco varianty A a B jsou dvě alternativy jejího prvního zobrazení.

### Verze 1 — původní funkční landing page

První verze sloužila jako funkční základ zadání. Jejím cílem bylo dodat hlavní uživatelský tok a technické jádro produktu:

- českou landing page pro srovnání amerických ETF;
- datovou sadu pěti fondů a vysvětlení rozdílu mezi metodikami vážení;
- kalkulačku nákladovosti;
- formulář pro získání PDF průvodce;
- serverovou validaci, ukládání leadů do Neon Postgres a vytvoření či zpřístupnění PDF;
- rate limiting, bezpečné zacházení s přístupovým tokenem a analytické události funnelu.

Podle zpětné vazby byla první podoba vizuálně příliš prázdná a působila genericky. To neznamenalo, že je nutné zahodit její funkční základ. Problém byl především v prezentaci produktu, vizuální hierarchii a tom, jak rychle návštěvník pochopí přínos nástroje.

### Verze 2 — redesign s prémiovým fintech vzhledem

Druhá verze reaguje na tuto zpětnou vazbu. Cílem je změnit způsob prezentace a uživatelskou cestu, nikoliv bezdůvodně přepisovat backend či ověřenou logiku.

Plánovaný směr redesignu:

- tmavé grafitové až téměř černé pozadí, střídmé limetkové akcenty a výraznější typografická hierarchie;
- propracovanější první obrazovka s vizuálně vrstveným náhledem skutečného produktu;
- účelové náhledy srovnání ETF a kalkulačky, typografické štítky tickerů a návrh obálky průvodce namísto náhodných dekorativních obrázků;
- konzistentní sada ikon, jemné dělicí linky a promyšlenější rozvržení sekcí;
- pečlivější responzivní zobrazení, zejména při šířce 360 px;
- přehlednější vysvětlení rozdílu mezi `RSP` a fondy váženými podle tržní kapitalizace;
- jasnější cesta od pochopení produktu k použití nástroje a vyžádání průvodce.

**Co se má zachovat:** zdrojová sada ETF, kalkulačková logika, formulářové a API kontrakty, databázové zápisy, generování a bezpečné zpřístupnění PDF, rate limiting, zacházení s tokenem, retenční pravidla a existující analytické události. Změna těchto částí by měla být provedena pouze tehdy, pokud je nezbytná, odděleně zdůvodněná a znovu ověřená.

### Dvě hero varianty uvnitř druhé verze

V rámci redesignu se mají porovnat dvě alternativy první obrazovky:

- **Varianta A — srovnání ETF jako první:** zdůrazňuje možnost porovnat fondy a pochopit jejich rozdíly. Primární akce vede ke srovnání.
- **Varianta B — kalkulačka nákladovosti jako první:** zdůrazňuje praktický výpočet nákladů. Primární akce vede ke kalkulačce.

Obě varianty patří do jedné druhé verze produktu a mají používat stejné ověřené údaje, kalkulačku, formulář a navazující obsah. Není to důvod udržovat dvě samostatné backendové implementace. Varianty nejprve slouží k internímu porovnání; skutečný veřejný A/B test lze vyhodnotit až po stabilním nasazení a ověření měření.

### Stav implementace

Tento README popisuje záměr redesignu a odděluje jej od prvotní funkční verze. Samotná dokumentace ani připravený brief nejsou důkazem, že všechny designové změny již byly dokončeny. Před odevzdáním je třeba porovnat text s aktuálním Gitem a doplnit konkrétní změněné soubory, výsledek testů a případnou URL Preview. Pokud je redesign dokončen, tento oddíl má být aktualizován ze skutečného diffu a výsledků ověření; pokud zůstává rozpracovaný, má být označen jako rozpracovaný.

## Architektura a tok dat

Zjednodušený tok hlavní konverze:

```
Návštěvník
    │
    ▼
Stránka a formulář Next.js
    │
    ▼
Serverová validace (Zod)
    │
    ├──────────────► Rate limiting
    │
    ▼
Uložení záznamu do Neon Postgres
    │
    ▼
Vytvoření / zpřístupnění PDF průvodce
    │
    ▼
Potvrzení výsledku návštěvníkovi
```

Analytické události měří kroky funnelu podle aktuální implementace. Konkrétní názvy API cest, databázových tabulek, proměnných prostředí a událostí se mají převzít z repozitáře, nikoliv odhadovat podle tohoto diagramu.

## Proč byl zvolen tento postup vývoje

Postup je zvolen tak, aby se nejprve ověřila správnost dat a základní funkčnost, teprve poté se optimalizovala prezentace a konverze. U finančního produktu by vizuální zlepšení nemělo zakrýt chybná data ani rozbít formulář, databázi či bezpečné zpřístupnění PDF.

1. **Nejprve pochopit zadání a repozitář.** Zkontrolovat `CLAUDE.md`, dokumentaci, strukturu aplikace, `package.json`, existující komponenty, zdrojová data, formulář, kalkulačku a analytické události. Tím se omezí zbytečné přepisování fungujících částí a předpoklady o skriptech nebo konfiguraci.
2. **Ověřit datový model a finanční fakta.** Srovnávací stránka stojí na důvěryhodnosti dat. Zvláštní pozornost vyžadují metodika `RSP`, datum vzniku a přesné označení obchodního místa `NYSE Arca`.
3. **Stabilizovat hlavní tok lead → PDF.** Validace, rate limiting, zápis do databáze, generování nebo zpřístupnění PDF a chybové stavy tvoří produktovou funkčnost. Redesign je nemá obcházet ani nahrazovat.
4. **Zachovat analytické kontrakty.** Bez měření návštěvnosti, interakcí a úspěšných žádostí nelze vyhodnotit, zda změny pomáhají. Události je potřeba prozkoumat před zásahem do CTA nebo formuláře.
5. **Navrhnout dvě odlišné varianty prvního zobrazení.** Obě představují stejný produkt, ale začínají jinou hodnotou pro uživatele: srovnáním ETF, nebo praktickou kalkulačkou nákladů. Ostatní části mají zůstat co nejvíce srovnatelné.
6. **Ověřit změny automaticky i ručně.** Testy, lint, typová kontrola a build zachytí část regresí; responzivní kontrola a ruční projití formuláře zase chyby, které samotné unit testy nemusí odhalit.
7. **Nasadit až po ověřovacím průchodu.** Lokální funkčnost není důkazem, že jsou správně nastavené produkční proměnné, databáze, plánované úlohy nebo veřejné URL. Stav nasazení se uvádí samostatně.

Toto pořadí odděluje tři otázky: **funguje produkt**, **jsou informace správné** a **vede rozhraní návštěvníka k žádoucí akci**. Každá vyžaduje jiný typ kontroly.

## Konverze a měření funnelu

### Hlavní konverze

Primární konverzí je **úspěšné vyžádání bezplatného průvodce**, nikoliv pouhé kliknutí na CTA ani otevření formuláře. Za úspěšné vyžádání se má považovat až stav potvrzený podle současného backendového kontraktu (například úspěšně zpracovaný formulář a uložený lead). Přesnou definici je nutné sladit s událostí v kódu, aby se do čitatele nezapočítávala pouhá návštěva formuláře.

Základní míra konverze:

```
Míra konverze (%) = (unikátní návštěvníci s úspěšnou žádostí o průvodce
                     / unikátní návštěvníci landing page) × 100
```

Pro srovnání variant musí být čitatel, jmenovatel, atribuční okno, pravidla pro boty a duplicitní návštěvy a způsob přiřazení variant shodné. Pokud se v implementaci nedá návštěvník spolehlivě deduplikovat, je třeba tuto metodickou limitaci zdokumentovat.

### Další ukazatele

| Ukazatel | Co měří | Proč je důležitý |
| --- | --- | --- |
| Míra kliknutí na hlavní CTA | Kliknutí na primární akci / unikátní návštěvníci | Ukáže, zda je vstupní nabídka srozumitelná a lákavá. |
| Míra interakce se srovnáním | Návštěvníci, kteří skutečně použili srovnání / unikátní návštěvníci | Ukáže, zda varianta vede k využití srovnávací funkce. |
| Míra zahájení a dokončení kalkulačky | Zahájené nebo dokončené použití / unikátní návštěvníci | Ukáže, zda kalkulačkový koncept vytváří smysluplnou interakci. |
| Míra úspěšného odeslání formuláře | Úspěšně odeslané formuláře / zahájené formuláře | Pomáhá rozlišit problém s motivací od problému ve formuláři. |
| Úspěšné zpřístupnění PDF | Úspěšně dostupné PDF / úspěšně uložené žádosti | Sleduje spolehlivost doručení po získání leadu. |

Události uvedené v tabulce jsou **měřicí kategorie**, ne tvrzení o přesných názvech již implementovaných eventů. Před změnou je třeba namapovat je na existující události a ověřit, že nedochází k dvojímu započítávání.

### Aktuální hodnota konverze

K datu poslední zaznamenané kontroly nebylo nasazení propojeno s Vercel projektem a nebyla k dispozici veřejná Preview ani Production URL. Z toho důvodu zde **není doložená produkční míra konverze** a neuvádí se smyšlené procento ani výsledek A/B testu. Konverzní poměr se doplní až po sběru skutečných návštěv a úspěšných žádostí.

## Dva koncepty prvního zobrazení a tři testovací hypotézy

Zadání redesignu počítá se dvěma variantami hero sekce. Nejprve mají být vytvořeny jako oddělené koncepty pro interní porovnání. Nemá se přidávat veřejný přepínač designu ani bez ověření pouštět dvě konkurenční varianty všem návštěvníkům.

### Varianta A — srovnání jako první

**Hlavní sdělení:** „Vyberte ETF podle toho, na čem skutečně záleží.“

- Popisuje možnost porovnat ETF a porozumět jejich důležitým rozdílům.
- Primární CTA: **Porovnat ETF**.
- Sekundární CTA: **Získat průvodce zdarma**.
- Vizuál: kompaktní náhled skutečného srovnání, tickerů a rozdílných metodik vážení.
- Předpokládaná výhoda: nejprve poskytne orientaci a kontext, což může budovat důvěru před vyžádáním průvodce.

### Varianta B — kalkulačka jako první

**Hlavní sdělení:** „Zjistěte, kolik mohou stát poplatky ETF.“

- Přivádí uživatele rovnou k praktickému nástroji pro porovnání nákladovosti.
- Primární CTA: **Spočítat poplatky**.
- Sekundární CTA: **Získat průvodce zdarma**.
- Vizuál: náhled skutečné kalkulačky a jejích vstupů a výstupů, nikoliv vymyšlených čísel.
- Předpokládaná výhoda: konkrétní úkol může zaujmout návštěvníky, kteří začínají otázkou poplatků.

Při pozdějším A/B testu se má měnit především koncepce hero sekce a hlavní CTA. Dataset, kalkulačková logika, formulář, sekundární nabídka průvodce, zbytek stránky i podmínky měření mají být shodné, aby bylo možné rozdíl rozumně připsat testované variantě. Obě verze musí používat skutečná projektová data, přístupnost a stejné funkční kontrakty.

### Tři hypotézy

| ID | Hypotéza | Primární měření | Co by výsledek znamenal |
| --- | --- | --- | --- |
| **H1 — srovnání aktivuje srovnání** | Varianta A dosáhne vyšší míry použití srovnávací funkce než varianta B, protože uživateli jasněji slibuje porovnání fondů. | Míra interakce se srovnáním podle varianty. | Pokud se hypotéza potvrdí, varianta A je vhodnější pro návštěvníky, kteří chtějí nejprve pochopit rozdíly mezi ETF. |
| **H2 — kalkulačka aktivuje kalkulačku** | Varianta B dosáhne vyšší míry zahájení a dokončení kalkulačky než varianta A, protože nástroj a jeho účel komunikuje už v prvním zobrazení. | Míra zahájení a dokončení kalkulačky podle varianty. | Pokud se hypotéza potvrdí, kalkulačkové sdělení je účinnější v přivedení návštěvníků k praktickému výpočtu. |
| **H3 — srovnání lépe převádí na lead** | Varianta A dosáhne vyšší míry úspěšných žádostí o průvodce než varianta B, protože poskytne kontext a pomůže návštěvníkovi porozumět hodnotě dalšího materiálu. | Hlavní konverze: unikátní návštěvník → úspěšná žádost o průvodce. | Pokud se hypotéza nepotvrdí, je potřeba posoudit nejen počet kliknutí, ale i dokončení formuláře a spolehlivé zpřístupnění PDF. |

Jde o **hypotézy, nikoliv naměřené výsledky**. H3 je hlavní obchodní hypotéza; H1 a H2 pomáhají vysvětlit případný rozdíl v hlavní konverzi.

### Jak test provést

1. Před spuštěním ověřit analytické události a zaznamenat výchozí konverzi, pokud už existuje dostatečně kvalitní návštěvnost.
2. Náhodně a stabilně rozdělit návštěvníky mezi A a B, ideálně 50/50, se stejnými podmínkami a bez vystavení osobních údajů v analytice.
3. Předem určit primární metriku (míru úspěšných žádostí o průvodce), podpůrné metriky, minimální prakticky významný efekt a požadovanou statistickou sílu. Potřebnou velikost vzorku vypočítat z výchozí konverze, ne ji odhadovat bez dat.
4. Nevyhodnocovat test jen podle několika prvních konverzí a neukončovat ho předčasně podle průběžného kolísání výsledků. Testovat dostatečně dlouho, aby varianty pokryly běžné dny a chování návštěvníků.
5. Společně s konverzí kontrolovat kvalitu lead-to-PDF toku, chyby formuláře, rychlost a mobilní použitelnost. Vyšší počet kliknutí sám o sobě není vítězství, pokud roste počet neúspěšných žádostí nebo klesá úspěšné doručení.
6. Výsledek zaznamenat včetně období, počtu návštěvníků a konverzí v každé variantě, intervalů nejistoty, omezení a rozhodnutí. Pokud je vzorek malý, uvést, že výsledek není průkazný.

## Spuštění lokálně

### Předpoklady

- Node.js kompatibilní s verzí používanou v projektu.
- npm.
- Přístup k Neon Postgres pro části aplikace, které vyžadují databázi.
- Proměnné prostředí nastavené podle skutečné konfigurace projektu.

### Instalace a vývojový server

```bash
npm install
npm run dev
```

Poté otevřete adresu vypsanou v terminálu, obvykle `http://localhost:3000`.

Nejdříve ověřte dostupné skripty:

```bash
npm run
```

### Produkční build lokálně

```bash
npm run build
npm run start
```

`npm run start` spusťte až po úspěšném vytvoření produkčního buildu. Pokud se názvy skriptů v aktuálním `package.json` liší, přednost má skutečná konfigurace projektu. Nespouštějte příkazy, které v projektu neexistují, jen proto, že jsou uvedeny v obecném návodu.

## Proměnné prostředí a databáze

1. Prohlédněte `.env.example`, dokumentaci v `docs/` a serverové moduly, které proměnné prostředí načítají.
2. Vytvořte lokální `.env.local` a doplňte přesné názvy proměnných požadované aktuální implementací.
3. Nastavte připojení k Neon Postgres a případné serverové klíče související s bezpečností nebo přístupem k PDF.
4. Pokud projekt používá databázové migrace či inicializační SQL, postupujte podle existující dokumentace. Neměňte schéma pouze na základě tohoto README.
5. Ověřte, že serverové tajné hodnoty nejsou dostupné v klientském kódu ani v proměnných s prefixem `NEXT_PUBLIC_`.

Tato dokumentace záměrně neodhaduje názvy všech proměnných prostředí. Rozhodující jsou `.env.example` a jejich skutečné použití v kódu. Přístupové údaje nevkládejte do Git repozitáře, logů ani veřejných screenshotů.

## Testování a kontrola kvality

Projekt používá Vitest. Nejprve ověřte skutečné skripty v `package.json` příkazem `npm run`. Potom spusťte dostupné kontroly, typicky:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

Tento seznam je příkladem běžného ověřovacího průchodu; **není tvrzením, že každý z uvedených skriptů existuje pod přesně tímto názvem**. Pokud `typecheck` není definován, použijte způsob kontroly typů nastavený v projektu. Do reportu uveďte přesný spuštěný příkaz a skutečný výsledek.

V jednom dřívějším vývojovém kroku bylo při kontrole datové vrstvy zaznamenáno **84 úspěšných testů**. Jde o historický výsledek tohoto kontrolního bodu, ne o potvrzení, že všechny testy a kontroly procházejí po každé další změně. Před odevzdáním je nutné je spustit znovu a uložit výsledek.

### Manuální kontrola UI a hlavního toku

- [ ]  Ověřit viewport 360 px, tablet a desktop.
- [ ]  Zkontrolovat, že stránka jako celek nepřetéká do stran.
- [ ]  Ověřit srovnání ETF a zobrazení rozdílu metodiky `RSP`.
- [ ]  Ovládat kalkulačku klávesnicí i dotykem a ověřit srozumitelnost výstupů.
- [ ]  Projít formulář: validace, načítání, chyba, úspěch a opakované odeslání.
- [ ]  Ověřit uložení leadu do Neon Postgres.
- [ ]  Ověřit vytvoření nebo zpřístupnění PDF a kontrolu přístupu.
- [ ]  Ověřit rate limiting a případné retenční úlohy v prostředí, kde skutečně běží.
- [ ]  Ověřit, že analytické události odpovídají reálným krokům a nespouštějí se duplicitně.
- [ ]  Zkontrolovat zdroje finančních hodnot, popisky obchodních míst a datum aktualizace.

Automatické testy nenahrazují kontrolu v prohlížeči ani ověření produkční konfigurace. Naopak samotné vizuální proklikání není náhradou za testy, typovou kontrolu a build.

## Spolupráce s AI: pravidla, prompty a kontrola výsledků

Projekt byl vyvíjen s podporou AI coding agenta (např. Claude Code nebo srovnatelného nástroje). Agent pomáhá s analýzou repozitáře, plánováním, implementací a návrhy testů, ale jeho výstup se nepovažuje za ověřený pouze proto, že jej agent označí za hotový. Odpovědnost za kontrolu dat, rozsahu změn a výsledků zůstává na člověku.

### Pravidla pro agenta

1. **Před změnou zkoumat existující projekt.** Přečíst `CLAUDE.md`, relevantní dokumentaci, skripty v `package.json`, související komponenty a testy. Nezačínat přepisem bez zjištění současného stavu.
2. **Nejdřív navrhnout plán, potom upravovat.** U většího úkolu vypsat rozsah, dotčené soubory, rizika a plán ověření; neblokovat práci zbytečnými dotazy, pokud lze bezpečně rozhodnout podle repozitáře.
3. **Zachovávat fungující základy.** U vizuálního redesignu nepřepisovat API, databázové schéma, retenční úlohy, tokenovou logiku ani analytické kontrakty, pokud to není nezbytné a odůvodněné.
4. **Nedoplňovat finanční fakta odhadem.** Používat zdrojovou datovou sadu a zdrojové odkazy. Nejasnosti označit a předat k lidské kontrole.
5. **Neodhadovat konfiguraci.** Názvy příkazů, proměnných prostředí, endpointů a eventů zjistit v projektu. Pokud něco nejde ověřit, uvést to jako otevřený bod.
6. **Zachovat češtinu ve všech textech pro uživatele.** Technická dokumentace a poznámky o spolupráci s AI mohou být v jiném jazyce, ale UI této aplikace musí zůstat přirozené a konzistentní v češtině.
7. **Chránit tajné údaje.** Nevypisovat obsah `.env`, přihlašovací údaje, tokeny ani citlivá produkční data do výstupů, screenshotů nebo logů.
8. **Neslibovat neprovedené kontroly.** Výsledek testu, buildu, deploye nebo databázové změny uvádět jen po skutečném provedení a ověření.
9. **Pracovat v malých kontrolovatelných změnách.** Po úpravě zkontrolovat diff, nevysvětlené změny a návaznost na zadání. Commit, databázovou změnu nebo nasazení popsat samostatně a neplést je s pouhou přípravou k vydání.

### Příklady zadání, která vystihují pracovní postup

Následující texty jsou **stručným shrnutím typů promptů použitých při práci**, ne úplným doslovným exportem historie konverzace.

**Prompt 1 — plánování a datová vrstva**

> Prozkoumej současný repozitář, pravidla projektu a zadání. Než začneš měnit soubory, navrhni malé implementační kroky. Zachovej zdrojová ETF data odděleně od UI, validuj datové struktury a doplň testy. Nevymýšlej finanční hodnoty; nejasné údaje označ k ručnímu ověření.
> 

**Prompt 2 — ověření funkčnosti**

> Ověř hlavní tok od vyplnění formuláře přes serverovou validaci a zápis do databáze až po zpřístupnění PDF. Neodhaluj tajné hodnoty. Spusť testy a další kontroly podle skutečných npm skriptů, zaznamenej přesné příkazy a výsledky a odliš ověřené chování od předpokladů.
> 

**Prompt 3 — redesign prvního zobrazení**

> Zachovej současnou technickou architekturu a stávající konverzní funnel. Připrav dva interně porovnatelné koncepty hero sekce: srovnání ETF a kalkulačku nákladů. Používej existující data a výpočtovou logiku, jasně odliš `RSP`, zachovej `NYSE Arca`, udrž UI v češtině a prověř mobilní šířku 360 px. Nepřidávej veřejný přepínač variant ani nepředstírej, že je proveden A/B test.
> 

### Jak kontrolovat výstup agenta

Každá větší změna se kontroluje na čtyřech úrovních:

| Úroveň | Kontrola | Důkaz, který se má uložit |
| --- | --- | --- |
| Zadání a rozsah | Porovnat diff s cílem a seznamem povolených změn. | Stručné shrnutí změněných souborů a zdůvodnění. |
| Kód a automatické kontroly | Spustit relevantní testy, lint, typovou kontrolu a build podle dostupných skriptů. | Přesný příkaz, exit code a výsledek; ne pouze tvrzení agenta. |
| Produktové chování | Ručně projít srovnání, kalkulačku, formulář, PDF a responsive stavy. | Seznam scénářů a jejich výsledek, případně screenshoty bez osobních údajů. |
| Fakta a provoz | Porovnat finanční údaje se zdroji, ověřit tajné hodnoty, nasazení a plánování úloh. | Odkaz na zdroj nebo popis kontroly a jasně uvedené neověřené body. |

### Co zaznamenávat v `ai-log/`

U každého významného kroku zaznamenat:

- datum/stage a použitý AI nástroj;
- cíl a prompt (u důležitých kroků pokud možno přesně);
- soubory, které agent četl a měnil;
- plánované a skutečně provedené změny;
- důležitá rozhodnutí a odmítnuté alternativy;
- nalezené chyby nebo nesprávné návrhy AI, kdo je odhalil a jak se ověřila oprava;
- přesné příkazy testů, lint, typecheck a build i jejich výsledek;
- co bylo ověřeno ručně, co zůstává neověřené a zda byl vytvořen commit nebo deploy.

Doporučená struktura repozitáře:

```
CLAUDE.md       # trvalé pokyny pro agenta
README.md       # produkt, spuštění, ověření, AI spolupráce a stav projektu
docs/           # technická rozhodnutí a produktové zadání
ai-log/         # prompty, kontrola výstupů, chyby a výsledky ověření
```

Pokud se skutečná struktura repozitáře liší, dokumentaci přizpůsobit existujícím souborům; samotné uvedení složky v README neznamená, že v ní již jsou kompletní záznamy.

## Zjištěné chyby, opravy a omezení

Smyslem tohoto oddílu není tvrdit, že každá chyba vzešla z AI, ale transparentně popsat konkrétní případy, kde samotný návrh nebo první verze nestačily a byla potřeba lidská kontrola.

| Případ | Co se zjistilo | Oprava nebo preventivní opatření | Poučení |
| --- | --- | --- | --- |
| Datum vzniku `RSP` | Údaj v pracovní verzi vyžadoval lidské ověření a opravu. | Použít hodnotu **24. 4. 2003** po kontrole a při dalším zobrazení zachovat návaznost na zdroj. | Fakt navržený AI není automaticky správný; finanční fakta kontrolovat vůči primárnímu nebo důvěryhodnému zdroji. |
| Vizuální kvalita první podoby | První podoba stránky působila příliš prázdně a genericky a nesplnila požadovanou úroveň produktu. | Bylo připraveno samostatné zadání redesignu s jasným vizuálním směrem, skutečnými náhledy UI a dvěma koncepcemi hero sekce. | Funkční stránka sama o sobě nestačí; UX a vizuální kvalitu je nutné posuzovat podle konkrétního produktu a cílové skupiny. |
| Stav vydání versus nasazení | Příprava k vydání nebyla totéž co skutečně nasazená aplikace: Vercel CLI nebylo nainstalováno a projekt nebyl propojen s Vercel projektem. | Stav se v dokumentaci uvádí jako **nenasazeno**, dokud nevznikne a není ověřena Preview/Production URL. | Zelené testy nebo připravené soubory nedokládají funkční produkční nasazení. |
| Automatické kontroly po dalších změnách | Dřívějších 84 úspěšných testů se vztahovalo ke konkrétnímu vývojovému kroku, nikoliv automaticky ke všem pozdějším změnám. | Před odevzdáním znovu spustit relevantní kontroly a zaznamenat aktuální výsledky. | Testovací výsledek vždy patří ke konkrétní verzi kódu a času spuštění. |

Další potenciální rizika — například záměna `NYSE Arca`, duplicitní analytické události, chybně odhadnuté env proměnné nebo uniklý PDF token — jsou zahrnuta v kontrolních pravidlech. Bez konkrétního záznamu v `ai-log/` by však neměla být prezentována jako již prokázané historické chyby.

## Bezpečnost a soukromí

- Tajné klíče a přístupové údaje patří výhradně do serverového prostředí.
- Vstupy validujte na serveru, i když jsou předem kontrolovány v prohlížeči.
- Zachovejte rate limiting, existující chybové stavy a přístupový mechanismus pro PDF.
- Přístupový token k PDF ani jiné tajné údaje nevkládejte do URL, klientsky dostupného zdrojového kódu nebo logů.
- Při úpravách databáze, retenčních pravidel nebo bezpečnostní logiky uveďte důvod a dopad změny.
- Texty o ochraně osobních údajů a právní upozornění nepovažujte za právně schválené bez samostatné kontroly.
- U A/B testu nepoužívejte osobní údaje jako součást identifikátoru varianty a nesbírejte více analytických údajů, než je potřebné.

## Nasazení a aktuální stav

Cílovou platformou je Vercel. Podle poslední zaznamenané kontroly však projekt **nebyl propojen s Vercel projektem** a nebyla vytvořena veřejná Preview ani Production URL. Vercel CLI nebylo v daném prostředí nainstalováno; přihlášení a propojení vyžadují interaktivní úkon uživatele. Proto nelze tvrdit, že je aplikace nasazená nebo že proběhl veřejný A/B test.

Po ověření lokální konfigurace a přihlášení lze obvykle postupovat takto:

```bash
vercel login
vercel link
vercel
```

Produkční vydání až po ověření Preview:

```bash
vercel --prod
```

Příkazy je nutné spouštět jen v odpovídajícím pracovním prostředí a jejich úspěch skutečně ověřit. Před nasazením nastavte potřebné proměnné prostředí ve Vercelu, ověřte připojení k produkčnímu Neon Postgres a potvrďte běh denního úklidu dat. Po nasazení projděte celý tok od formuláře po bezpečné zpřístupnění PDF.

### Aktuální stav podle posledního doloženého reportu

- Datová vrstva měla v dřívějším kroku **84 úspěšných testů**.
- Technický brief pro redesign uvádí, že hlavní tok lead → PDF, připojení k Neon, rate limiting a ochrana tokenu byly v předchozím ověřovacím kroku funkční; po pozdějších změnách je třeba důležité scénáře znovu ověřit.
- Denní retenční úklid byl připraven, ale jeho produkční plánování je samostatná provozní kontrola.
- Podle posledního reportu nebyla provedena databázová změna ani commit daného releasového kroku.
- Vercel Preview/Production URL není doložena.
- Produkční míra konverze ani výsledky A/B testu zatím nejsou doložené.

Stav průběžně aktualizujte podle skutečného Gitu, výstupů testů a hostingu. Tento seznam není náhradou za čerstvé ověření repozitáře.

## Kontrolní seznam před vydáním

- [ ]  Zkontrolovat `git status` a diff; ujistit se, že jsou zahrnuty jen zamýšlené změny.
- [ ]  Spustit aktuální testy, lint, typovou kontrolu a build; zapsat reálné výsledky.
- [ ]  Ověřit zdroje finančních hodnot, datum `RSP` a označení `NYSE Arca`.
- [ ]  Projít varianty hero na šířce 360 px, na tabletu a na desktopu.
- [ ]  Ověřit funkčnost srovnání, kalkulačky, formuláře a chybových/úspěšných stavů.
- [ ]  Ověřit databázový zápis, PDF, rate limiting a přístupový token bez vyzrazení tajných údajů.
- [ ]  Ověřit analytické události, jejich definici a absenci duplicit.
- [ ]  Nastavit a ověřit produkční proměnné prostředí a plánování retenčních úloh.
- [ ]  Vytvořit a zkontrolovat Preview deployment, následně teprve rozhodnout o produkčním vydání.
- [ ]  A/B test spustit až tehdy, kdy je nasazení stabilní a měření konverze validované.
- [ ]  Doplnit reálnou URL, aktuální datum testů, stav commitu a výsledky konverze; neuvádět neověřené hodnoty.
- [ ]  Dokončit `ai-log/` pro významné kroky tak, aby bylo možné dohledat prompty, rozhodnutí, chyby a ověření.

---

Projekt je technickou ukázkou vývoje s pomocí AI. Výsledek se hodnotí nejen podle toho, zda aplikace vypadá a funguje správně, ale také podle důvěryhodnosti finančních údajů, reprodukovatelnosti kontrol, bezpečného zpracování leadů a transparentního popisu toho, co bylo skutečně implementováno, otestováno a nasazeno.