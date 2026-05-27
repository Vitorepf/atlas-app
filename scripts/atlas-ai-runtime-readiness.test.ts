/**
 * Atlas AI · Mobile · Runtime Readiness view-model.
 *
 * Testa o builder puro `buildRuntimeReadinessView` sem depender de
 * React Native / Expo. Pattern paralelo ao desktop.
 */
import assert from 'node:assert/strict'
import {
  buildRuntimeReadinessView,
  statusLabelFor,
  type AtlasAiRuntimeReadiness,
} from '../lib/atlasAi/runtimeReadiness'

const noopRefresh = (): void => {}

function readyPayload(): AtlasAiRuntimeReadiness {
  return {
    schema_version: 'atlas.ai.runtime_readiness.v1',
    status: 'ready',
    summary: { total: 11, passed: 11, partial: 0, failed: 0, critical_failed: 0, warn_failed: 0 },
    blockers: [],
    warnings: [],
    certification_hash: 'a'.repeat(64),
  }
}

function partialPayload(): AtlasAiRuntimeReadiness {
  return {
    schema_version: 'atlas.ai.runtime_readiness.v1',
    status: 'partial',
    summary: { total: 11, passed: 10, partial: 1, failed: 0, critical_failed: 0, warn_failed: 1 },
    blockers: [],
    warnings: ['control_plane_runtime'],
    certification_hash: 'b'.repeat(64),
  }
}

function blockedPayload(): AtlasAiRuntimeReadiness {
  return {
    schema_version: 'atlas.ai.runtime_readiness.v1',
    status: 'blocked',
    summary: { total: 11, passed: 7, partial: 1, failed: 3, critical_failed: 3, warn_failed: 1 },
    blockers: ['mission_foundation_readiness', 'router_runtime_readiness', 'follow_through_loop'],
    warnings: ['control_plane_runtime'],
    certification_hash: 'c'.repeat(64),
  }
}

/* ---------- status labels ---------- */

assert.equal(statusLabelFor('ready'), 'Pronto')
assert.equal(statusLabelFor('partial'), 'Parcial')
assert.equal(statusLabelFor('blocked'), 'Bloqueado')
assert.equal(statusLabelFor('unavailable'), 'Indisponível')
assert.equal(statusLabelFor('loading'), 'Verificando')

/* ---------- payload null antes do load → loading ---------- */
{
  const view = buildRuntimeReadinessView(null, false, false, noopRefresh)
  assert.equal(view.status, 'loading')
  assert.equal(view.statusLabel, 'Verificando')
  assert.equal(view.isLoaded, false)
  assert.equal(view.criticalFailed, 0)
  assert.equal(view.blockers.length, 0)
  assert.equal(view.certificationHashShort, null)
}

/* ---------- payload null após load → unavailable ---------- */
{
  const view = buildRuntimeReadinessView(null, false, true, noopRefresh)
  assert.equal(view.status, 'unavailable')
  assert.equal(view.statusLabel, 'Indisponível')
  assert.equal(view.isLoaded, true)
}

/* ---------- ready ---------- */
{
  const view = buildRuntimeReadinessView(readyPayload(), false, true, noopRefresh)
  assert.equal(view.status, 'ready')
  assert.equal(view.statusLabel, 'Pronto')
  assert.equal(view.criticalFailed, 0)
  assert.equal(view.warnFailed, 0)
  assert.equal(view.blockers.length, 0)
  assert.equal(view.warnings.length, 0)
  assert.equal(view.certificationHash?.length, 64)
  assert.equal(view.certificationHashShort?.length, 17, 'short hash = 16 chars + ellipsis')
  assert.ok(view.certificationHashShort?.endsWith('…'))
}

/* ---------- partial ---------- */
{
  const view = buildRuntimeReadinessView(partialPayload(), false, true, noopRefresh)
  assert.equal(view.status, 'partial')
  assert.equal(view.statusLabel, 'Parcial')
  assert.equal(view.warnFailed, 1)
  assert.deepEqual(Array.from(view.warnings), ['control_plane_runtime'])
  assert.equal(view.blockers.length, 0)
}

/* ---------- blocked ---------- */
{
  const view = buildRuntimeReadinessView(blockedPayload(), false, true, noopRefresh)
  assert.equal(view.status, 'blocked')
  assert.equal(view.statusLabel, 'Bloqueado')
  assert.equal(view.criticalFailed, 3)
  assert.equal(view.blockers.length, 3)
  assert.ok(view.blockers.includes('mission_foundation_readiness'))
}

/* ---------- status desconhecido degrada para unavailable ---------- */
{
  const raw: AtlasAiRuntimeReadiness = {
    schema_version: 'atlas.ai.runtime_readiness.v1',
    status: 'martian-status-xyz',
  }
  const view = buildRuntimeReadinessView(raw, false, true, noopRefresh)
  assert.equal(view.status, 'unavailable', 'status canon desconhecido NÃO pode poluir UI')
}

/* ---------- view-model expõe campos canônicos ---------- */
{
  const view = buildRuntimeReadinessView(readyPayload(), false, true, noopRefresh)
  for (const key of [
    'status',
    'statusLabel',
    'isLoaded',
    'isFetching',
    'criticalFailed',
    'warnFailed',
    'blockers',
    'warnings',
    'certificationHash',
    'certificationHashShort',
    'refresh',
  ]) {
    assert.ok(key in view, `view-model deve expor ${key}`)
  }
}

/* ---------- refresh callback é exposto ---------- */
{
  let called = false
  const view = buildRuntimeReadinessView(readyPayload(), false, true, () => {
    called = true
  })
  view.refresh()
  assert.equal(called, true)
}

/* ------------------------------------------------------------------ */
/* UX bundle (Runtime UX certification — mobile parity com desktop)    */
/* ------------------------------------------------------------------ */

function bundlePayload(): AtlasAiRuntimeReadiness {
  return {
    schema_version: 'atlas.ai.runtime_readiness.v1',
    status: 'partial',
    summary: { total: 11, passed: 10, partial: 1, failed: 0, critical_failed: 0, warn_failed: 1 },
    blockers: [],
    warnings: ['control_plane_runtime'],
    certification_hash: 'd'.repeat(64),
    ux_bundle: {
      schema_version: 'atlas.ai.runtime_readiness.ux_bundle.v1',
      active_mission: {
        id: 'm-mobile-42',
        title: 'Atlas Mobile Vox V6',
        status: 'in_progress',
        mission_type: 'release',
        next_action: 'rodar voice-realtime smoke',
      },
      pending_approvals_count: 2,
      latest_handoff: {
        target: 'atlas_forge',
        reason: 'forge_handoff_after_obra_intake',
        status: 'dispatched',
        created_at: '2026-05-19T11:00:00+00:00',
      },
      assisted_execution: {
        schema_version: 'atlas.ai.assisted_execution.operational_ux.v1',
        status: 'ready',
        route_target: 'atlas_dev',
        flow_id: 'programming.dev',
        doctrine_gate_status: 'passed',
        selected_drivers: ['atdd', 'tdd', 'ux_driven', 'risk_driven'],
        context_memory_status: 'ready',
        context_must_keep_coverage: 1,
        areg_status: 'ready',
        areg_path: 'local_dev',
        outcome_feedback_status: 'recorded',
        aemor_feedback_status: 'ready_to_record',
        blockers: [],
        summary: 'Execucao assistida governada por AEDPDS, contexto, AREG e feedback AEMOR.',
        hash: 'f'.repeat(64),
      },
    },
  }
}

{
  const view = buildRuntimeReadinessView(bundlePayload(), false, true, noopRefresh)
  assert.equal(view.activeMission?.id, 'm-mobile-42')
  assert.equal(view.activeMission?.title, 'Atlas Mobile Vox V6')
  assert.equal(view.activeMission?.nextAction, 'rodar voice-realtime smoke')
  assert.equal(view.pendingApprovalsCount, 2)
  assert.equal(view.latestHandoff?.target, 'atlas_forge')
  assert.equal(view.latestHandoff?.isForge, true)
  assert.equal(view.latestHandoff?.isDev, false)
  assert.equal(view.assistedExecution?.doctrineGateStatus, 'passed')
  assert.deepEqual(Array.from(view.assistedExecution?.selectedDrivers ?? []), ['atdd', 'tdd', 'ux_driven', 'risk_driven'])
  assert.equal(view.assistedExecution?.aregPath, 'local_dev')
  assert.equal(view.assistedExecution?.aemorFeedbackStatus, 'ready_to_record')
  assert.equal(view.primaryBlocker, 'control plane runtime')
}

{
  const view = buildRuntimeReadinessView(readyPayload(), false, true, noopRefresh)
  assert.equal(view.activeMission, null)
  assert.equal(view.pendingApprovalsCount, 0)
  assert.equal(view.latestHandoff, null)
  assert.equal(view.assistedExecution, null)
  assert.equal(view.primaryBlocker, null)
}

{
  // atlas_dev handoff detecta isDev mas não isForge
  const raw: AtlasAiRuntimeReadiness = {
    status: 'ready',
    summary: { total: 11, passed: 11, partial: 0, failed: 0, critical_failed: 0, warn_failed: 0 },
    blockers: [],
    warnings: [],
    certification_hash: 'e'.repeat(64),
    ux_bundle: {
      active_mission: null,
      pending_approvals_count: 0,
      latest_handoff: {
        target: 'atlas_dev',
        reason: 'explicit_programming_composer_contract',
        status: 'dispatched',
        created_at: null,
      },
    },
  }
  const view = buildRuntimeReadinessView(raw, false, true, noopRefresh)
  assert.equal(view.latestHandoff?.isDev, true)
  assert.equal(view.latestHandoff?.isForge, false)
}

{
  // primaryBlocker humaniza id snake_case
  const view = buildRuntimeReadinessView(blockedPayload(), false, true, noopRefresh)
  assert.equal(view.primaryBlocker, 'mission foundation readiness')
  assert.ok(!view.primaryBlocker.includes('_'))
}

console.log('atlas-ai-runtime-readiness · all assertions passed (including ux_bundle)')
