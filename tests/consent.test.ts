import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MARKETING_CONSENT } from "@/lib/consent";

// Fingerprint of the consent wording for each published version. When the text
// changes, add a new version here instead of editing an existing entry: stored
// consents refer to these versions.
const PUBLISHED_VERSIONS: Record<string, string> = {
  "2026-10-13": "c281ed83",
};

function fingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 8);
}

describe("marketing consent wording", () => {
  it("has a published version", () => {
    expect(Object.keys(PUBLISHED_VERSIONS)).toContain(MARKETING_CONSENT.version);
  });

  it("has not changed without a new version", () => {
    expect(fingerprint(MARKETING_CONSENT.text)).toBe(PUBLISHED_VERSIONS[MARKETING_CONSENT.version]);
  });

  it("says that consent is voluntary and separate from getting the guide", () => {
    expect(MARKETING_CONSENT.text).toContain("dobrovolný");
    expect(MARKETING_CONSENT.text).toContain("nemá vliv na získání průvodce");
    expect(MARKETING_CONSENT.text).toContain("odvolat");
  });
});
