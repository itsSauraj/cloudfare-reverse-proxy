import type { HealthResult, Route } from "./types";

const PROBE_TIMEOUT_MS = 3000;

/** Probe one app's /health endpoint with a bounded timeout. Never throws. */
async function probe(route: Route): Promise<HealthResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(new URL("/health", route.target), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return {
      id: route.id,
      target: route.target,
      online: res.ok,
      status: res.status,
      ms: Date.now() - t0,
    };
  } catch {
    return { id: route.id, target: route.target, online: false, status: 0, ms: Date.now() - t0 };
  }
}

/** Probe every enabled app in parallel. */
export async function checkAll(routes: Route[]): Promise<HealthResult[]> {
  return Promise.all(routes.filter((r) => r.enabled).map(probe));
}
