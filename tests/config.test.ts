import { describe, expect, it } from "vitest";
import {
  getDatabaseUrl,
  getEventStoreUrl,
  getLeadCaptureConfig,
  getPrivacyConfig,
} from "@/lib/config";
import { TEST_ENV } from "./helpers/database";

describe("lead capture configuration", () => {
  it("is complete when every value is present and valid", () => {
    const result = getLeadCaptureConfig(TEST_ENV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.leadRetentionDays).toBe(30);
    expect(result.config.consentedLeadRetentionDays).toBe(365);
    expect(result.config.funnelEventRetentionDays).toBe(90);
    expect(result.config.controller.email).toBe("privacy@example.invalid");
  });

  it("reports everything as missing for an empty environment", () => {
    const result = getLeadCaptureConfig({});
    expect(result).toEqual({
      ok: false,
      missing: [
        "CONSENTED_LEAD_RETENTION_DAYS",
        "DATABASE_URL",
        "DATA_CONTROLLER_ADDRESS",
        "DATA_CONTROLLER_EMAIL",
        "DATA_CONTROLLER_NAME",
        "FUNNEL_EVENT_RETENTION_DAYS",
        "LEAD_RETENTION_DAYS",
        "PRIVACY_NOTICE_VERSION",
      ],
    });
  });

  it.each(Object.keys(TEST_ENV))("is incomplete without %s", (name) => {
    const result = getLeadCaptureConfig({ ...TEST_ENV, [name]: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual([name]);
  });

  it("treats whitespace-only controller details as missing", () => {
    const result = getPrivacyConfig({ ...TEST_ENV, DATA_CONTROLLER_NAME: "   " });
    expect(result.ok).toBe(false);
  });

  it.each(["not-an-email", "a@b", ""])("rejects controller email %j", (email) => {
    expect(getPrivacyConfig({ ...TEST_ENV, DATA_CONTROLLER_EMAIL: email }).ok).toBe(false);
  });

  describe.each(["LEAD_RETENTION_DAYS", "CONSENTED_LEAD_RETENTION_DAYS", "FUNNEL_EVENT_RETENTION_DAYS"])(
    "%s",
    (name) => {
      it.each(["0", "-5", "abc", "1.5", "1e3", "3651", "99999", "", " "])(
        "does not accept %j and has no silent default",
        (days) => {
          const result = getPrivacyConfig({ ...TEST_ENV, [name]: days });
          expect(result.ok).toBe(false);
          if (!result.ok) expect(result.missing).toEqual([name]);
        },
      );
    },
  );

  it.each(["", "not a url", "https://example.invalid/db", "mysql://example.invalid/db"])(
    "does not treat %j as a database URL",
    (url) => {
      expect(getDatabaseUrl({ DATABASE_URL: url })).toBeNull();
    },
  );

  it("stores funnel events only with both a database and an event retention period", () => {
    expect(getEventStoreUrl(TEST_ENV)).toBe(TEST_ENV.DATABASE_URL);
    expect(getEventStoreUrl({ ...TEST_ENV, FUNNEL_EVENT_RETENTION_DAYS: undefined })).toBeNull();
    expect(getEventStoreUrl({ ...TEST_ENV, FUNNEL_EVENT_RETENTION_DAYS: "0" })).toBeNull();
    expect(getEventStoreUrl({ ...TEST_ENV, DATABASE_URL: undefined })).toBeNull();
    // Event storage does not depend on the controller details.
    expect(getEventStoreUrl({ DATABASE_URL: TEST_ENV.DATABASE_URL, FUNNEL_EVENT_RETENTION_DAYS: "90" })).toBe(
      TEST_ENV.DATABASE_URL,
    );
  });

  it("never includes configured values in the list of missing names", () => {
    const result = getLeadCaptureConfig({ ...TEST_ENV, DATA_CONTROLLER_EMAIL: "broken" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(JSON.stringify(result.missing)).not.toContain("password");
  });
});
