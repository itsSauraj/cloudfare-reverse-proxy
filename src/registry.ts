import type { Route } from "./types";
import { TtlCache } from "./cache";
// Bundled at build time (tsconfig `resolveJsonModule`). Used as the local dev
// registry AND as the last-good fallback if a KV read/parse ever fails.
import localRoutes from "../routes.json";

const TTL_MS = 60_000;
const cache = new TtlCache<Route[]>(TTL_MS);

/**
 * Coerce arbitrary JSON into a clean, safe Route[]:
 *  - drops entries missing a string `route`/`target`,
 *  - trims a trailing slash from `route` (except "/") so "/youtube" and
 *    "/youtube/" behave identically,
 *  - defaults `enabled` to true,
 *  - SECURITY: keeps only http/https targets, so the proxy can never be pointed
 *    at file://, data:, or other schemes. This is the target allowlist — never
 *    proxy an arbitrary URL.
 */
export function normalize(raw: unknown): Route[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Route =>
        !!r && typeof r.route === "string" && typeof r.target === "string",
    )
    .map((r) => ({
      ...r,
      route: r.route !== "/" ? r.route.replace(/\/+$/, "") : "/",
      enabled: r.enabled !== false,
    }))
    .filter((r) => {
      try {
        const proto = new URL(r.target).protocol;
        return proto === "http:" || proto === "https:";
      } catch {
        return false;
      }
    });
}

/**
 * Load the route registry.
 *
 * Source is chosen by `env.REGISTRY_SOURCE`:
 *   "local" -> bundled routes.json (dev)
 *   else    -> KV key "apps" (production)
 *
 * Results are memoized per-isolate for TTL_MS so we don't hit KV on every
 * request, yet edits still propagate within ~a minute. On a KV read/parse
 * failure we keep the last-good value (or fall back to the bundled JSON) rather
 * than blanking the whole site.
 */
export async function loadRegistry(env: Env): Promise<Route[]> {
  const now = Date.now();
  const fresh = cache.get(now);
  if (fresh) return fresh;

  if (env.REGISTRY_SOURCE === "local") {
    return cache.set(normalize(localRoutes), now);
  }

  try {
    const json = await env.ROUTES.get("apps", { cacheTtl: 60 });
    const routes = json
      ? normalize(JSON.parse(json))
      : cache.last() ?? normalize(localRoutes);
    return cache.set(routes, now);
  } catch (err) {
    console.log(
      JSON.stringify({ level: "error", msg: "registry load failed", error: String(err) }),
    );
    return cache.set(cache.last() ?? normalize(localRoutes), now);
  }
}
