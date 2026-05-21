/**
 * Atlas Rich Input · upload retry helper.
 *
 * Generic exponential-retry wrapper used by composer upload pipelines on
 * every Atlas surface. Mirrors the desktop `chunkedUploadAsset` policy
 * (3 attempts, backoff 280ms × 2^n) so mobile / desktop / future surfaces
 * share one resiliency contract.
 *
 * Respects AbortSignal — aborts immediately if `signal.aborted`.
 */

export interface RetryOptions {
  /** Max attempts including the first (default 3). */
  maxAttempts?: number
  /** Base backoff in ms (default 280). Real delay = base × 2^(attempt-1). */
  baseDelayMs?: number
  /** Optional AbortSignal — aborts retry immediately when triggered. */
  signal?: AbortSignal
  /** Optional per-attempt callback (telemetry). */
  onAttempt?: (attempt: number, error: unknown) => void
}

/**
 * Run `task()` with exponential retry. Re-throws the last error when all
 * attempts fail or when the signal aborts.
 */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
  const baseDelay = Math.max(0, options.baseDelayMs ?? 280)
  const signal = options.signal

  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    try {
      return await task()
    } catch (err) {
      lastError = err
      options.onAttempt?.(attempt, err)
      if (signal?.aborted) throw err
      if (attempt >= maxAttempts) throw err
      const delay = baseDelay * Math.pow(2, attempt - 1)
      await sleep(delay, signal)
    }
  }

  throw lastError ?? new Error('withRetry: no attempts executed')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = globalThis.setTimeout(() => {
      resolve()
    }, ms)
    if (signal) {
      const onAbort = () => {
        globalThis.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}
