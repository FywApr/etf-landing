// Sanitised server-side diagnostics.
//
// Error messages and details from the database can contain submitted values
// (a unique-violation detail includes the email address, for example), so only
// the error class and the Postgres error code are ever logged.

export function describeError(error: unknown): { errorName: string; code?: string } {
  const errorName = error instanceof Error ? error.name : typeof error;
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code.slice(0, 20)
      : undefined;
  return code ? { errorName, code } : { errorName };
}

export function logServerError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, JSON.stringify(describeError(error)));
}
