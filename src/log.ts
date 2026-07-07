import type { LogRecord } from "./types";

/** A per-request correlation id, echoed back to the client as X-Request-Id. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Emit one structured JSON access-log line. With `observability.enabled` in
 * wrangler.jsonc, Workers Logs captures console output; `wrangler tail` streams
 * it in production and `wrangler dev` prints it locally.
 */
export function logRequest(record: LogRecord): void {
  console.log(JSON.stringify(record));
}
