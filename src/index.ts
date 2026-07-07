import { loadRegistry } from "./registry";
import { findRoute } from "./router";
import { proxy } from "./proxy";
import { handleAdmin, ADMIN_PREFIX } from "./admin";
import { newRequestId, logRequest } from "./log";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const reqId = newRequestId();
    const t0 = Date.now();
    const url = new URL(request.url);

    try {
      // Reserved control endpoints — matched before registry routing so an app
      // can never shadow them.
      if (url.pathname === ADMIN_PREFIX || url.pathname.startsWith(`${ADMIN_PREFIX}/`)) {
        return await handleAdmin(request, env);
      }

      // Gateway self-health (distinct from each app's /health).
      if (url.pathname === "/health") {
        return new Response("ok", { status: 200 });
      }

      const routes = await loadRegistry(env);
      const match = findRoute(url.pathname, routes);

      if (!match) {
        logRequest({
          reqId, method: request.method, path: url.pathname,
          routeId: null, target: null, status: 404, ms: Date.now() - t0,
        });
        return new Response("Not found", {
          status: 404,
          headers: { "X-Request-Id": reqId },
        });
      }

      const resp = await proxy(request, match, reqId);

      // Re-wrap to attach X-Request-Id while keeping the body a live stream.
      const out = new Response(resp.body, resp);
      out.headers.set("X-Request-Id", reqId);

      logRequest({
        reqId, method: request.method, path: url.pathname,
        routeId: match.id, target: match.target, status: resp.status, ms: Date.now() - t0,
      });
      return out;
    } catch (err) {
      logRequest({
        reqId, method: request.method, path: url.pathname,
        routeId: null, target: null, status: 502, ms: Date.now() - t0, error: String(err),
      });
      return new Response("Bad gateway", {
        status: 502,
        headers: { "X-Request-Id": reqId },
      });
    }
  },
} satisfies ExportedHandler<Env>;
