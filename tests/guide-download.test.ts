import { describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/lib/db";
import { handleGuideDownload } from "@/lib/guide/download";
import { generateGuideToken, hashGuideToken } from "@/lib/guide-token";

const PDF = Buffer.from("%PDF-1.7 test");
const LEAD_ROW = {
  session_id: "0b0e6d1e-6c2f-4d53-9d38-5a1a2f0c9e11",
  variant: "fees",
  utm_source: "meta",
  utm_medium: null,
  utm_campaign: "launch",
  utm_content: null,
  utm_term: null,
};

/** A fake executor that records the order of operations. */
function setup(
  options: { found?: boolean; lookupFails?: boolean; eventFails?: boolean; limited?: boolean } = {},
) {
  const order: string[] = [];
  const sql = vi.fn<SqlExecutor>(async (text) => {
    if (text.includes("rate_limits")) {
      order.push("limit");
      return [{ client_key: "*", hits: options.limited ? 100000 : 1, seconds_left: 42 }];
    }
    if (text.includes("from leads")) {
      order.push("lookup");
      if (options.lookupFails) throw Object.assign(new Error("connection refused"), { code: "08006" });
      return options.found === false ? [] : [LEAD_ROW];
    }
    order.push("event");
    if (options.eventFails) throw new Error("insert failed");
    return [];
  });
  const renderPdf = vi.fn(async () => {
    order.push("render");
    return PDF;
  });
  return { order, sql, renderPdf };
}

describe("handleGuideDownload", () => {
  it("validates the token, then renders, then records the download", async () => {
    const { order, sql, renderPdf } = setup();
    const { token } = generateGuideToken();

    const result = await handleGuideDownload(token, { sql, renderPdf });

    expect(result).toEqual({ status: "ok", pdf: PDF });
    expect(order).toEqual(["limit", "lookup", "render", "event"]);
  });

  it("looks the token up by hash and never sends the plaintext to the database", async () => {
    const { sql, renderPdf } = setup();
    const { token } = generateGuideToken();
    await handleGuideDownload(token, { sql, renderPdf });

    for (const [text, params] of sql.mock.calls) {
      expect(text).not.toContain(token);
      expect(params).not.toContain(token);
    }
    const lookup = sql.mock.calls.find(([text]) => text.includes("from leads"))!;
    expect(lookup[1]).toEqual([hashGuideToken(token)]);
  });

  it("records the event with the lead's session and no token or email", async () => {
    const { sql, renderPdf } = setup();
    const { token } = generateGuideToken();
    await handleGuideDownload(token, { sql, renderPdf });

    const params = sql.mock.calls.find(([text]) => text.includes("insert into funnel_events"))![1];
    expect(params).toContain("guide_download");
    expect(params).toContain(LEAD_ROW.session_id);
    expect(params).toContain("/api/guide");
    expect(JSON.stringify(params)).not.toContain(token);
    expect(JSON.stringify(params)).not.toContain("@");
  });

  it.each([undefined, null, "", "short", "a".repeat(44), ["x"]])(
    "answers not_found for malformed token %j without a query or a render",
    async (token) => {
      const { sql, renderPdf } = setup();
      expect(await handleGuideDownload(token, { sql, renderPdf })).toEqual({ status: "not_found" });
      expect(sql).not.toHaveBeenCalled();
      expect(renderPdf).not.toHaveBeenCalled();
    },
  );

  it("answers not_found for an unknown or expired token, without rendering or recording", async () => {
    const { order, sql, renderPdf } = setup({ found: false });
    const result = await handleGuideDownload(generateGuideToken().token, { sql, renderPdf });
    expect(result).toEqual({ status: "not_found" });
    expect(order).toEqual(["limit", "lookup"]);
  });

  it("answers rate_limited before looking the token up when the limit is exceeded", async () => {
    const { order, sql, renderPdf } = setup({ limited: true });
    const result = await handleGuideDownload(generateGuideToken().token, { sql, renderPdf });
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 42 });
    expect(order).toEqual(["limit"]);
  });

  it("does not count malformed tokens against the database at all", async () => {
    const { sql, renderPdf } = setup();
    await handleGuideDownload("not-a-token", { sql, renderPdf });
    expect(sql).not.toHaveBeenCalled();
  });

  it("is unavailable when no database is configured", async () => {
    const { renderPdf } = setup();
    const result = await handleGuideDownload(generateGuideToken().token, { sql: null, renderPdf });
    expect(result).toEqual({ status: "unavailable" });
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("is unavailable, with a sanitised log, when the lookup fails", async () => {
    const { sql, renderPdf } = setup({ lookupFails: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { token } = generateGuideToken();

    expect(await handleGuideDownload(token, { sql, renderPdf })).toEqual({ status: "unavailable" });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("08006");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("connection refused");
    log.mockRestore();
  });

  it("does not record a download when the PDF cannot be generated", async () => {
    const { order, sql } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const renderPdf = vi.fn(async () => {
      throw new Error("font missing");
    });

    const result = await handleGuideDownload(generateGuideToken().token, { sql, renderPdf });

    expect(result).toEqual({ status: "unavailable" });
    expect(order).toEqual(["limit", "lookup"]);
    log.mockRestore();
  });

  it("delivers the guide without recording anything when event storage is not configured", async () => {
    const { order, sql, renderPdf } = setup();
    const result = await handleGuideDownload(generateGuideToken().token, {
      sql,
      renderPdf,
      recordEvent: false,
    });
    expect(result).toEqual({ status: "ok", pdf: PDF });
    expect(order).toEqual(["limit", "lookup", "render"]);
  });

  it("still delivers the guide when recording the event fails", async () => {
    const { sql, renderPdf } = setup({ eventFails: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handleGuideDownload(generateGuideToken().token, { sql, renderPdf });

    expect(result).toEqual({ status: "ok", pdf: PDF });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
