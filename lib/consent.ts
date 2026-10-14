// The exact marketing-consent wording shown next to the checkbox.
//
// The stored `marketing_consent_text_version` must identify this text, so any
// change to the wording requires a new version. tests/consent.test.ts fails if
// the text changes without the version changing.

export const MARKETING_CONSENT = {
  version: "2026-10-13",
  text: "Souhlasím se zasíláním vzdělávacího obsahu o ETF na můj e-mail. Souhlas je dobrovolný, nemá vliv na získání průvodce a mohu ho kdykoli odvolat.",
} as const;
