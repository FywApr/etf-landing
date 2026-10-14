// In-process Postgres (PGlite, Postgres compiled to WebAssembly) with the real
// schema applied. This exercises the actual SQL, but it is not Neon: nothing in
// the test suite connects to a remote database.

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SqlExecutor } from "@/lib/db";

/** Reads a SQL file relative to db/, or relative to the project root if it starts with "tests/". */
export function readSql(fileName: string): string {
  const base = fileName.startsWith("tests/") ? process.cwd() : path.join(process.cwd(), "db");
  return readFileSync(path.join(base, fileName), "utf8");
}

export interface TestDatabase {
  sql: SqlExecutor;
  /** Runs SQL that is not parameterised, such as the schema file. */
  exec: (text: string) => Promise<void>;
  close: () => Promise<void>;
}

/** A database built from `schemaFiles` in order; by default the current schema. */
export async function createTestDatabase(
  schemaFiles: string[] = ["schema.sql"],
): Promise<TestDatabase> {
  const db = new PGlite();
  for (const file of schemaFiles) await db.exec(readSql(file));
  return {
    sql: async (text, params) =>
      (await db.query<Record<string, unknown>>(text, [...params])).rows,
    exec: async (text) => {
      await db.exec(text);
    },
    close: () => db.close(),
  };
}

export const TEST_ENV = {
  DATABASE_URL: "postgresql://user:password@example.invalid/db",
  DATA_CONTROLLER_NAME: "Test Controller",
  DATA_CONTROLLER_ADDRESS: "Test Street 1, Test City",
  DATA_CONTROLLER_EMAIL: "privacy@example.invalid",
  PRIVACY_NOTICE_VERSION: "test-1",
  LEAD_RETENTION_DAYS: "30",
  CONSENTED_LEAD_RETENTION_DAYS: "365",
  FUNNEL_EVENT_RETENTION_DAYS: "90",
};
