import type { Route } from "./types";

/**
 * True iff `pathname` is served by `route` — matching on path *segments*, not a
 * raw substring. `startsWith` alone would let "/youtube" match "/youtubeXYZ";
 * requiring the next char to be a "/" boundary (or end-of-string) fixes that.
 * "/" is the explicit root catch-all.
 */
export function matchesPrefix(pathname: string, route: string): boolean {
  if (route === "/") return true;
  if (!pathname.startsWith(route)) return false;
  const rest = pathname.slice(route.length);
  return rest === "" || rest.startsWith("/");
}

/**
 * Find the best-matching enabled route for a path.
 * - Disabled routes are skipped.
 * - The longest (most specific) matching prefix wins, so "/youtube" beats "/".
 */
export function findRoute(pathname: string, routes: Route[]): Route | undefined {
  return routes
    .filter((r) => r.enabled)
    .filter((r) => matchesPrefix(pathname, r.route))
    .sort((a, b) => b.route.length - a.route.length)[0];
}
