/**
 * Opt-in, best-effort HTML rewriting for apps mounted under a path prefix that
 * emit ROOT-ABSOLUTE URLs (e.g. `/assets/main.css`) assuming they live at "/".
 * When enabled per-route (`rewriteHtml: true`), attribute URLs starting with a
 * single "/" get the mount prefix prepended, streamed via HTMLRewriter (no
 * buffering).
 *
 * PREFER configuring each app with a base path instead (Next.js `basePath`,
 * Vite `base`, CRA `homepage`). That is the default in this gateway because it
 * is the only approach that fixes the classes this rewriter CANNOT:
 *   - runtime JS URLs: fetch('/api'), import('/chunk.js'), router navigations,
 *     serviceWorker.register('/sw.js'), WebSocket/SSE endpoints
 *   - framework chunk loading referenced from the bundle (e.g. Next /_next/*)
 *   - CSS url(...) inside external stylesheets or inline <style>
 *   - <img srcset> candidate lists
 *   - <script type="importmap"> and embedded JSON (e.g. __NEXT_DATA__)
 *   - a page-set <base href>
 * Treat this as a stopgap for apps you cannot reconfigure, not a real fix.
 */

class AttrRewriter {
  constructor(
    private readonly prefix: string,
    private readonly attr: string,
  ) {}

  element(el: Element): void {
    const value = el.getAttribute(this.attr);
    // Root-absolute only. Skip protocol-relative ("//cdn...") and absolute URLs.
    if (value && value.startsWith("/") && !value.startsWith("//")) {
      el.setAttribute(this.attr, this.prefix + value);
    }
  }
}

/** Wrap an HTML response so root-absolute attribute URLs are prefixed. */
export function rewriteHtml(resp: Response, prefix: string): Response {
  return new HTMLRewriter()
    .on("a[href]", new AttrRewriter(prefix, "href"))
    .on("link[href]", new AttrRewriter(prefix, "href"))
    .on("script[src]", new AttrRewriter(prefix, "src"))
    .on("img[src]", new AttrRewriter(prefix, "src"))
    .on("form[action]", new AttrRewriter(prefix, "action"))
    .on("source[src]", new AttrRewriter(prefix, "src"))
    .transform(resp);
}
