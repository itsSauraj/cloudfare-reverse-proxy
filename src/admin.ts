import { loadRegistry } from "./registry";
import { checkAll } from "./health";

/** Reserved prefix for gateway control endpoints; matched before app routing. */
export const ADMIN_PREFIX = "/__gateway";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Constant-time-ish bearer check against the ADMIN_TOKEN secret. */
function authorized(request: Request, env: Env): boolean {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Handle /__gateway/* endpoints. Guarded by ADMIN_TOKEN so internal target URLs
 * are never exposed to unauthenticated callers.
 *   GET /__gateway/routes  -> full registry, including disabled entries
 *   GET /__gateway/health  -> live per-app health probes
 */
export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }

  const path = new URL(request.url).pathname;
  const routes = await loadRegistry(env);

  if (path === `${ADMIN_PREFIX}/routes`) {
    return json({ count: routes.length, routes });
  }
  if (path === `${ADMIN_PREFIX}/health`) {
    return json({ apps: await checkAll(routes) });
  }
  return json({ error: "not found" }, 404);
}
