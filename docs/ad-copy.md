# Ad copy and landing routes

Two ad variants, each pointing at its own route. Both routes render the same `LandingPage` component with a different `variant`, so the first screen repeats the ad's promise.

| | Variant A: comparison | Variant B: fees |
|---|---|---|
| Variant id | `compare` | `fees` |
| Route | `/` | `/poplatky` |
| Headline | Americká ETF v jedné tabulce | Kolik vás stojí poplatky ETF za 20 let? |
| Text | Porovnejte poplatky, burzu a dostupnost vybraných amerických ETF. Česky a s odkazy na zdroje. | Zadejte vklad a horizont. Kalkulačka ukáže, jak se poplatky mohou projevit na konečné hodnotě investice. |
| CTA | Zobrazit srovnání | Spočítat poplatky |
| First screen | Headline, text, CTA to the comparison, and a fee overview of all funds | Headline, text, CTA, and the calculator directly below |

## How the page keeps each promise

- **Variant A** promises fees, exchange and availability. The comparison shows the expense ratio and listing venue per fund with links to issuer sources. Availability is covered by the "Dostupnost pro investory z EU" section, which explains that PRIIPs KID status was not verified and must be checked with the broker.
- **Variant B** uses 20 years as an example. The calculator starts at 20 years and the visitor can change the horizon and every other input.

## Wording constraints

- No ad or page text uses "největší" or any other ranking. The data has no assets-under-management figures to support one.
- No performance figures, guarantees or recommendations.
- The ads do not say the funds can be bought by EU retail investors.

## Visitor path

Ad → matching first screen → comparison and calculator (both ungated) → guide section with the lead form. The lead form is not connected yet; it stores and sends nothing.
