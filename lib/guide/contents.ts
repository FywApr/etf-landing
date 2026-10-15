// Title and section headings of the PDF guide. Shared by the PDF and the
// landing-page preview, so the preview can never list a section the PDF lacks.

export const GUIDE_TITLE = "Průvodce americkými ETF pro české investory";

export const GUIDE_SECTIONS = {
  overview: "Rychlý přehled",
  comparison: "1. Rozšířené srovnání fondů",
  priips: "2. PRIIPs, KID a dostupnost pro investory z EU",
  checklist: "3. Kontrolní seznam pro výběr ETF",
  methodology: "4. Metodika, aktuálnost a upozornění",
} as const;
