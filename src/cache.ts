/**
 * A tiny in-isolate time-to-live memo.
 *
 * Cloudflare reuses a Worker isolate across many requests, so a value cached
 * here survives between requests for the life of the isolate. This wrapper adds
 * an explicit TTL and, crucially, distinguishes "not loaded yet" (`entry` is
 * null) from "loaded and empty" — the latter must still be cached so an empty
 * result doesn't cause every request to re-run the loader (the reload-thrash bug
 * in the original registry sketch).
 */
export class TtlCache<T> {
  private entry: { value: T; at: number } | null = null;

  constructor(private readonly ttlMs: number) {}

  /** Return the cached value if it is still fresh, else undefined. */
  get(now: number): T | undefined {
    if (this.entry && now - this.entry.at < this.ttlMs) return this.entry.value;
    return undefined;
  }

  /** The last value stored, regardless of freshness (used for keep-last-good). */
  last(): T | undefined {
    return this.entry?.value;
  }

  set(value: T, now: number): T {
    this.entry = { value, at: now };
    return value;
  }
}
