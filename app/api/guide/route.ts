import { cookies } from "next/headers";
import { getDatabaseUrl, getEventStoreUrl } from "@/lib/config";
import { createSqlExecutor } from "@/lib/db";
import { guideCookieName } from "@/lib/guide-cookie";
import { handleGuideDownload } from "@/lib/guide/download";
import { GUIDE_FILE_NAME, renderGuidePdf } from "@/lib/guide/render";
import { clientKeyFromHeaders } from "@/lib/rate-limit";

const PROTECTED_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

function textResponse(status: number, message: string, extra: Record<string, string> = {}) {
  return new Response(message, {
    status,
    headers: { ...PROTECTED_HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra },
  });
}

// The token comes only from the HttpOnly cookie set by the lead form. A token
// in the query string is ignored.
export async function GET(request: Request): Promise<Response> {
  const token = (await cookies()).get(guideCookieName())?.value;
  const databaseUrl = getDatabaseUrl();

  const result = await handleGuideDownload(token, {
    sql: databaseUrl ? createSqlExecutor(databaseUrl) : null,
    renderPdf: renderGuidePdf,
    recordEvent: getEventStoreUrl() !== null,
    clientKey: clientKeyFromHeaders(request.headers),
  });

  switch (result.status) {
    case "not_found":
      // The same answer for a missing, malformed, unknown or expired token.
      return textResponse(
        404,
        "Přístup k průvodci vypršel nebo v tomto prohlížeči není k dispozici. Požádejte o průvodce znovu.",
      );
    case "rate_limited":
      return textResponse(429, "Příliš mnoho pokusů. Zkuste to prosím za několik minut.", {
        "Retry-After": String(result.retryAfterSeconds),
      });
    case "unavailable":
      return textResponse(503, "Průvodce je dočasně nedostupný. Zkuste to prosím později.");
    case "ok":
      return new Response(new Uint8Array(result.pdf), {
        status: 200,
        headers: {
          ...PROTECTED_HEADERS,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${GUIDE_FILE_NAME}"`,
          "Content-Length": String(result.pdf.byteLength),
        },
      });
  }
}
