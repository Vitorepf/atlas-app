import assert from 'node:assert/strict'
import { buildPatamar4View, patamar4StatusLabel } from '../lib/atlasAi/patamar4State'

const refresh = () => undefined

// 1. Loading state when not yet loaded.
{
  const v = buildPatamar4View(null, false, false, refresh)
  assert.equal(v.status, 'loading')
  assert.equal(v.subsystemCount, 0)
}

// 2. Unavailable when raw=null after load.
{
  const v = buildPatamar4View(null, false, true, refresh)
  assert.equal(v.status, 'unavailable')
}

// 3. Canonical envelope parsed correctly.
{
  const raw = {
    schema_version: 'atlas.patamar4.state.v1',
    generated_at: '2026-05-26T09:00:00Z',
    kernel: {
      kernel_hash: 'sha256:abc',
      invariants: [
        { id: 'a', class: 'petreo' },
        { id: 'b', class: 'elastic' },
      ],
      violation_count: 1,
    },
    cognitive_function_atlas: { subsystem_count: 51, group_count: 13 },
    autonomy_admission: { ticket_count: 100 },
    reconciliation: {
      summary: {
        tick_count: 60,
        outcomes: { auto_applied: 40, noop_no_gap: 20 },
      },
    },
    teos_i4: { tree_count: 30 },
    swarm: { dispatch_count: 30 },
    temporary_domain: { active_capsule_count: 5 },
    antifragility: {
      wrapper_multiplier_m: 0.95,
      components: { m_scorecard: 1.0, m_observability: 0.85 },
    },
    claim_policy: {
      benchmark_claim_allowed: false,
      rivals_claim_allowed: false,
      superiority_claim_allowed: false,
      external_rivals_certification_touched: false,
    },
  }
  const v = buildPatamar4View(raw, false, true, refresh)
  assert.equal(v.status, 'ready')
  assert.equal(v.subsystemCount, 51)
  assert.equal(v.groupCount, 13)
  assert.equal(v.kernel.kernelHash, 'sha256:abc')
  assert.equal(v.kernel.invariantCount, 2)
  assert.equal(v.kernel.violationCount, 1)
  assert.equal(v.reconciliation.tickCount, 60)
  assert.equal(v.reconciliation.outcomeTally.auto_applied, 40)
  assert.equal(v.antifragility.wrapperMultiplierM, 0.95)
  assert.equal(v.claimPolicySafe, true)
}

// 4. Stale when claim policy drifted.
{
  const raw = {
    claim_policy: {
      benchmark_claim_allowed: true,
      rivals_claim_allowed: false,
      superiority_claim_allowed: false,
      external_rivals_certification_touched: false,
    },
  }
  const v = buildPatamar4View(raw, false, true, refresh)
  assert.equal(v.status, 'stale')
  assert.equal(v.claimPolicySafe, false)
}

// 5. Status labels.
assert.equal(patamar4StatusLabel('ready'), 'Ativo')
assert.equal(patamar4StatusLabel('loading'), 'Carregando…')
assert.equal(patamar4StatusLabel('stale'), 'Drift de claim policy')
assert.equal(patamar4StatusLabel('unavailable'), 'Indisponível')

console.log('patamar4State.test.ts · 5 assertions verde')
