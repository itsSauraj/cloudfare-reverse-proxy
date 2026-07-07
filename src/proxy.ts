import type { Route } from "./types";
import { rewriteHtml } from "./rewrite";

/**
 * Forward a request to the app behind `route` and return its (streamed) response.
 *
 * Key correctness points vs. the original sketch:
 *  - Prefix stripping uses `slice(route.length)` (anchored) instead of
 *    `.replace(prefix, "")`, which would replace the first substring occurrence
 *    anywhere in the path. We always ensure a leading "/" so the destination URL
 *    resolves as root-absolute against the target origin.
 *  - `stripPrefix === false` forwards the full path unchanged — for apps that
 *    are genuinely mounted at their prefix via a base path.
 *  - A fresh Headers is built (inbound headers are immutable) and the `Host`
 *    header is dropped so the runtime sets Host = target host. Forwarding the
 *    apex Host would break Vercel-style origins that route by Host.
 *  - The body streams through for non-GET/HEAD; the response is returned without
 *    buffering (no `.text()`/`.arrayBuffer()`).
 */
export async function proxy(
  request: Request,
  route: Route,
  reqId: string,
): Promise<Response> {
  const url = new URL(request.url);

  const strip = route.stripPrefix !== false;
  let path =
    strip && route.route !== "/"
      ? url.pathname.slice(route.route.length)
      : url.pathname;
  if (!path.startsWith("/")) path = "/" + path;

  const destination = new URL(path + url.search, route.target);

  const headers = new Headers(request.headers);
  headers.delete("host"); // let the runtime set Host = target host
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) {
    const priorXff = request.headers.get("X-Forwarded-For");
    headers.set("X-Forwarded-For", priorXff ? `${priorXff}, ${clientIp}` : clientIp);
  }
  headers.set("X-Request-Id", reqId);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const init: RequestInit = {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual", // pass origin 3xx back to the browser; don't follow server-side
  };
  if (hasBody) {
    // Required when streaming a request body in the Workers/undici fetch model.
    (init as RequestInit & { duplex: "half" }).duplex = "half";
  }

  const resp = await fetch(destination.toString(), init);

  if (route.rewriteHtml) {
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("text/html")) {
      return rewriteHtml(resp, route.route);
    }
  }
  return resp;
}
