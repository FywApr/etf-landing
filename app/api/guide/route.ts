import { getDatabaseUrl, getEventStoreUrl } from "@/lib/config";
import { createSqlExecutor } from "@/lib/db";
import { handleGuideDownload } from "@/lib/guide/download";
import { GUIDE_FILE_NAME, renderGuidePdf } from "@/lib/guide/render";

// The token arrives in the query string, so nothing here may log the URL.
const PROTECTED_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...PROTECTED_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  const databaseUrl = getDatabaseUrl();

  const result = await handleGuideDownload(token, {
    sql: databaseUrl ? createSqlExecutor(databaseUrl) : null,
    renderPdf: renderGuidePdf,
    recordEvent: getEventStoreUrl() !== null,
  });

  if (result.status === "not_found") {
    // The same answer for malformed, unknown and expired tokens.
    return textResponse(404, "Odkaz je neplatný nebo jeho platnost vypršela.");
  }
  if (result.status === "unavailable") {
    return textResponse(503, "Průvodce je dočasně nedostupný. Zkuste to prosím později.");
  }

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
