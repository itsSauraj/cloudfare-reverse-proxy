/**
 * A single entry in the route registry.
 *
 * The registry is an array of these, sourced from a local `routes.json` in dev
 * or a Cloudflare KV value in production (see registry.ts). `Env` is NOT defined
 * here — it is generated into worker-configuration.d.ts by `wrangler types`.
 */
export interface Route {
  /** Stable identifier for the app (used in logs and the admin endpoint). */
  id: string;
  /** Path prefix this app is mounted at, e.g. "/youtube". "/" is the catch-all. */
  route: string;
  /** Origin to forward to, e.g. "http://localhost:3001" or "https://app.vercel.app". */
  target: string;
  /** Disabled routes are ignored by the router (but still shown by the admin endpoint). */
  enabled: boolean;
  /**
   * Whether to strip the `route` prefix before forwarding.
   * Default: true (sketch behavior — app thinks it lives at "/").
   * Set FALSE for apps configured with a matching base path (basePath / base):
   * the full path is forwarded so the app's own absolute URLs resolve correctly.
   */
  stripPrefix?: boolean;
  /**
   * Opt-in best-effort HTMLRewriter fallback for apps that emit root-absolute
   * asset URLs and cannot be reconfigured with a base path.
   * Default: false. See rewrite.ts for what it can and cannot fix.
   */
  rewriteHtml?: boolean;
}

/** Result of probing one app's /health endpoint. */
export interface HealthResult {
  id: string;
  target: string;
  online: boolean;
  /** Upstream HTTP status, or 0 if the probe failed/timed out. */
  status: number;
  /** Round-trip time in milliseconds. */
  ms: number;
}

/** Structured access-log record emitted once per request. */
export interface LogRecord {
  reqId: string;
  method: string;
  path: string;
  routeId: string | null;
  target: string | null;
  status: number;
  ms: number;
  error?: string;
}
