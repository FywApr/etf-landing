// Server-side recording of funnel events.

import type { SqlExecutor } from "@/lib/db";
import {
  MAX_EVENT_BODY_BYTES,
  clientEventSchema,
  type EventName,
  type Utm,
  type Variant,
} from "@/lib/analytics/events";

export interface StoredEvent {
  eventId: string;
  sessionId: string;
  name: EventName;
  variant: Variant;
  path: string;
  properties: Record<string, string>;
  utm: Utm;
}

// A repeated delivery of the same event id is ignored, not stored twice.
const INSERT_EVENT_SQL = `
  insert into funnel_events
    (event_id, session_id, name, variant, path, properties,
     utm_source, utm_medium, utm_campaign, utm_content, utm_term)
  values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
  on conflict (event_id) do nothing`;

export async function insertEvent(sql: SqlExecutor, event: StoredEvent): Promise<void> {
  await sql(INSERT_EVENT_SQL, [
    event.eventId,
    event.sessionId,
    event.name,
    event.variant,
    event.path,
    JSON.stringify(event.properties),
    event.utm.source ?? null,
    event.utm.medium ?? null,
    event.utm.campaign ?? null,
    event.utm.content ?? null,
    event.utm.term ?? null,
  ]);
}

export type EventRequestStatus = 204 | 400 | 413 | 503;

/**
 * Handles one request to the public events endpoint. Returns only a status
 * code: the response never describes what was wrong or echoes the payload.
 */
export async function handleClientEventRequest(
  body: string,
  sql: SqlExecutor | null,
): Promise<EventRequestStatus> {
  if (Buffer.byteLength(body, "utf8") > MAX_EVENT_BODY_BYTES) return 413;

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return 400;
  }

  const parsed = clientEventSchema.safeParse(json);
  if (!parsed.success) return 400;
  if (!sql) return 503;

  await insertEvent(sql, parsed.data);
  return 204;
}
