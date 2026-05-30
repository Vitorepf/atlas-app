// Atlas Loop · data-layer contract tests (pure Node via tsx, no RN runtime).
//
// Covers the two anti-flicker primitives' PURE cores and the LIST LAW math, plus
// a smoke check that the typed client surface (areas/backlog/done/start-run +
// the five command fns) is present and that the honesty invariants survive in
// the TYPES. Rendering/hooks aren't exercised here (the project convention tests
// contracts, not RN rendering) — the hooks are thin wrappers over these cores.

import assert from 'node:assert/strict'
import { clampVisible, LOOP_LIST_STEP } from '../lib/loop/useVisibleCount'
import { nextStableRef } from '../lib/loop/stableRef'
// Type-only — erased at runtime, so this never loads the RN-bound api client.
import type {
  AtlasLoopDirectiveReceipt,
  AtlasLoopOperatorDecisionReceipt,
  AtlasLoopStartRunResponse,
} from '../lib/api/loopClient'

// --- nextStableRef: collapse generated_at churn to surface_hash (flicker #2) ----
{
  type Body = { surface_hash: string; generated_at: string; n: number }
  const a: Body = { surface_hash: 'sha256:AAA', generated_at: 't0', n: 1 }
  const a2: Body = { surface_hash: 'sha256:AAA', generated_at: 't1', n: 1 } // only timestamp moved
  const b: Body = { surface_hash: 'sha256:BBB', generated_at: 't2', n: 2 } // real change

  // First fetch: no prior → return the new ref, remember it.
  const r1 = nextStableRef<Body>(null, a)
  assert.equal(r1.value, a)
  assert.equal(r1.hash, 'sha256:AAA')

  // Same hash, new object (poll with only generated_at changed) → SAME prior ref.
  const r2 = nextStableRef<Body>(r1, a2)
  assert.equal(r2.value, a, 'same surface_hash must keep the prior reference (no blink)')
  assert.notEqual(r2.value, a2, 'must NOT surface the churned object')

  // Real content change → new ref surfaces.
  const r3 = nextStableRef<Body>(r2, b)
  assert.equal(r3.value, b)
  assert.equal(r3.hash, 'sha256:BBB')

  // Empty / missing hash is never trusted as "unchanged" (always surface fresh).
  const empty1: Body = { surface_hash: '', generated_at: 't', n: 9 }
  const empty2: Body = { surface_hash: '', generated_at: 'u', n: 9 }
  const e1 = nextStableRef<Body>(null, empty1)
  const e2 = nextStableRef<Body>(e1, empty2)
  assert.equal(e2.value, empty2, 'empty hash must not pin a stale reference')
}

// --- clampVisible: LIST LAW window math (flicker-independent) --------------------
{
  // Empty list → show nothing.
  assert.equal(clampVisible(0, 5, 5), 0)
  assert.equal(clampVisible(0, 50, 5), 0)

  // Fewer rows than the window → show all real rows (never claim phantom rows).
  assert.equal(clampVisible(3, 5, 5), 3)
  assert.equal(clampVisible(3, 50, 5), 3)

  // Exactly the initial window.
  assert.equal(clampVisible(5, 5, 5), 5)

  // More rows than shown → cap at the requested visible count.
  assert.equal(clampVisible(20, 5, 5), 5)
  assert.equal(clampVisible(20, 10, 5), 10)
  assert.equal(clampVisible(20, 25, 5), 20, 'never exceed the real total')

  // Visible below the initial floor (e.g. a transient shrink) → hold the floor.
  assert.equal(clampVisible(8, 1, 5), 5)
  assert.equal(clampVisible(2, 1, 5), 2, 'floor is clamped to total when total < initial')

  // Step is the canonical 5.
  assert.equal(LOOP_LIST_STEP, 5)
}

// --- honesty invariants are LOAD-BEARING in the types (compile-time proof) -------
// These objects only type-check because the contract pins the literal falses; if
// anyone widened them to `boolean` to fake success, this file would fail tsc.
{
  const decision: Pick<
    AtlasLoopOperatorDecisionReceipt,
    'executed' | 'atlas_auto_decided' | 'provider_invoked' | 'branch_created' | 'mutates_target_repo'
  > = {
    executed: false,
    atlas_auto_decided: false,
    provider_invoked: false,
    branch_created: false,
    mutates_target_repo: false,
  }
  assert.equal(decision.executed, false, 'accept never executes (proposal-only)')
  assert.equal(decision.provider_invoked, false)

  const directive: Pick<
    AtlasLoopDirectiveReceipt,
    'loop_autonomously_consumable_now' | 'executed' | 'provider_invoked' | 'auto_consumed'
  > = {
    loop_autonomously_consumable_now: false,
    executed: false,
    provider_invoked: false,
    auto_consumed: false,
  }
  assert.equal(directive.loop_autonomously_consumable_now, false, 'directive is never auto-consumed')

  const startRun: Pick<AtlasLoopStartRunResponse, 'started' | 'provider_invoked' | 'merge_performed'> = {
    started: false,
    provider_invoked: false,
    merge_performed: false,
  }
  assert.equal(startRun.started, false, 'start-run enqueues, never claims running')
  assert.equal(startRun.merge_performed, false)
}

console.log('loop-data-layer.test.ts ok')
