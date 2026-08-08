interface Bucket {
  count: number;
  windowStart: number;
}

/** Fixed-window rate limiter kept in memory. */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private limit: number, private windowMs: number) {}

  /** Returns true when the call is allowed. */
  hit(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    bucket.count++;
    return bucket.count <= this.limit;
  }

  /** Drop stale buckets so the map does not grow unbounded. */
  sweep(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs) this.buckets.delete(key);
    }
  }
}
