// Atlas Loop · pure stable-reference reducer (no React, no RN, no react-query).
//
// The anti-flicker core (flicker fix #2). Kept dependency-free so it is unit
// testable in pure Node and carries zero import weight. The hook `useStableByHash`
// in ./index wraps this over a ref.

/** Any loop read-model body carries a deterministic, timestamp-stripped surface_hash. */
export interface HasSurfaceHash {
  surface_hash: string
}

/**
 * Decide which reference to surface for a freshly-fetched read-model body. The
 * backend stamps a volatile `generated_at` AFTER computing `surface_hash` (the
 * hash is over the body minus every `generated_at`), so two polls that differ
 * only by timestamp share one `surface_hash`. react-query's structural sharing
 * can't see that (the timestamp is a real string diff) and emits a new top-level
 * reference each tick → the screen blinks.
 *
 * Given the previously-surfaced {hash,value} and the new value, return the PRIOR
 * reference when the hash is unchanged and valid (identity stays stable across
 * polls → memoized children skip re-render → mount-only `entering` never
 * re-fires), otherwise the new one. Never mutates, never fabricates — it only
 * ever returns one of the two REAL inputs. An empty/missing hash is never trusted
 * as "unchanged", so a body without a usable hash always surfaces fresh.
 */
export function nextStableRef<T extends HasSurfaceHash>(
  prev: { hash: string; value: T } | null,
  next: T,
): { hash: string; value: T } {
  const hash = next.surface_hash
  if (prev !== null && typeof hash === 'string' && hash !== '' && prev.hash === hash) {
    return prev
  }
  return { hash, value: next }
}
