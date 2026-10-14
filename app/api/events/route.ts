import { MAX_EVENT_BODY_BYTES } from "@/lib/analytics/events";
import { handleClientEventRequest, type EventRequestStatus } from "@/lib/analytics/store";
import { getEventStoreUrl } from "@/lib/config";
import { createSqlExecutor } from "@/lib/db";
import { logServerError } from "@/lib/log";

// Public endpoint for browser funnel events. Responses carry a status code and
// nothing else; request bodies are never logged.
export async function POST(request: Request): Promise<Response> {
  let status: EventRequestStatus;

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_EVENT_BODY_BYTES) {
    status = 413;
  } else {
    try {
      // Null without a database or without an event retention period: then
      // events are validated but not stored.
      const databaseUrl = getEventStoreUrl();
      status = await handleClientEventRequest(
        await request.text(),
        databaseUrl ? createSqlExecutor(databaseUrl) : null,
      );
    } catch (error) {
      logServerError("events", error);
      status = 503;
    }
  }

  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}
