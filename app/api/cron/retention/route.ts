import { createSqlExecutor } from "@/lib/db";
import { handleRetentionCleanupRequest } from "@/lib/retention-job";

// Daily retention cleanup, scheduled in vercel.json. DELETES expired leads,
// funnel events and rate-limit counters in the DATABASE_URL database. Only GET
// is exported, because Vercel Cron sends GET; other methods get 405.
export async function GET(request: Request): Promise<Response> {
  const { status, body } = await handleRetentionCleanupRequest(
    request.headers.get("authorization"),
    process.env,
    createSqlExecutor,
  );
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
