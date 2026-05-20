import assert from 'node:assert/strict'
import { withRetry } from '../lib/richInput/uploadRetry'

async function main() {
  // ─── Sucesso na 1ª tentativa ─────────────────────────────────────────
  {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      return 'ok'
    }, { maxAttempts: 3 })
    assert.equal(result, 'ok')
    assert.equal(calls, 1, 'sucesso · 1 call apenas')
  }

  // ─── Sucesso na 2ª tentativa (1 erro transiente) ─────────────────────
  {
    let attempts = 0
    const result = await withRetry(async () => {
      attempts++
      if (attempts < 2) throw new Error('transient')
      return 'recovered'
    }, { maxAttempts: 3, baseDelayMs: 1 })
    assert.equal(result, 'recovered')
    assert.equal(attempts, 2)
  }

  // ─── Esgota retries ──────────────────────────────────────────────────
  {
    let attempts = 0
    let caught: unknown = null
    try {
      await withRetry(async () => {
        attempts++
        throw new Error(`fail ${attempts}`)
      }, { maxAttempts: 3, baseDelayMs: 1 })
    } catch (err) {
      caught = err
    }
    assert.ok(caught instanceof Error)
    assert.equal((caught as Error).message, 'fail 3', 'último erro propagado')
    assert.equal(attempts, 3, 'tentou 3× e parou')
  }

  // ─── onAttempt callback ──────────────────────────────────────────────
  {
    const attemptLog: Array<{ attempt: number; msg: string }> = []
    let triggered = 0
    try {
      await withRetry(async () => {
        triggered++
        throw new Error(`attempt-${triggered}`)
      }, {
        maxAttempts: 3,
        baseDelayMs: 1,
        onAttempt: (attempt, err) => {
          attemptLog.push({ attempt, msg: err instanceof Error ? err.message : String(err) })
        },
      })
    } catch {
      // expected
    }
    assert.equal(attemptLog.length, 3)
    assert.equal(attemptLog[0].attempt, 1)
    assert.equal(attemptLog[0].msg, 'attempt-1')
    assert.equal(attemptLog[2].attempt, 3)
    assert.equal(attemptLog[2].msg, 'attempt-3')
  }

  // ─── AbortSignal pre-aborted ─────────────────────────────────────────
  {
    const preAborted = new AbortController()
    preAborted.abort()
    let abortCaught: unknown = null
    try {
      await withRetry(async () => 'never', { signal: preAborted.signal })
    } catch (err) {
      abortCaught = err
    }
    assert.ok(abortCaught instanceof Error)
    assert.equal((abortCaught as Error).name, 'AbortError')
  }

  // ─── AbortSignal durante backoff ─────────────────────────────────────
  {
    const midAbort = new AbortController()
    let midAbortAttempts = 0
    const midAbortPromise = withRetry(async () => {
      midAbortAttempts++
      throw new Error('retry-me')
    }, {
      maxAttempts: 5,
      baseDelayMs: 50,
      signal: midAbort.signal,
    })

    // Aborta após primeira tentativa começar a fazer backoff
    await new Promise((r) => setTimeout(r, 20))
    midAbort.abort()

    let midCaught: unknown = null
    try {
      await midAbortPromise
    } catch (err) {
      midCaught = err
    }
    assert.ok(midCaught instanceof Error, 'mid-abort deve rejeitar')
    assert.ok(midAbortAttempts >= 1 && midAbortAttempts <= 2, `abort cedo · ${midAbortAttempts} tentativas`)
  }

  // ─── maxAttempts=1 (sem retry) ───────────────────────────────────────
  {
    let attempts = 0
    let caught: unknown = null
    try {
      await withRetry(async () => {
        attempts++
        throw new Error('single')
      }, { maxAttempts: 1 })
    } catch (err) {
      caught = err
    }
    assert.equal(attempts, 1)
    assert.ok(caught instanceof Error)
    assert.equal((caught as Error).message, 'single')
  }

  console.log('✓ uploadRetry tests passaram')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
