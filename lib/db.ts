// Database access through the Neon serverless HTTP driver.
//
// The HTTP driver sends one statement per request and has no interactive
// transactions. Anything that must be atomic is therefore written as a single
// SQL statement (see lib/leads.ts), which Postgres executes atomically.

import { neon } from "@neondatabase/serverless";

/** Runs one parameterised statement. Values are always passed as parameters. */
export type SqlExecutor = (
  text: string,
  params: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

export function createSqlExecutor(databaseUrl: string): SqlExecutor {
  const sql = neon(databaseUrl);
  return async (text, params) => (await sql.query(text, [...params])) as Record<string, unknown>[];
}
