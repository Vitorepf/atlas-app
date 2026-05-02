import assert from 'node:assert/strict'
import {
  providerProjectionAuditFilterLine,
  providerProjectionAuditItems,
  providerProjectionAuditMetaLine,
  providerProjectionAuditOverviewLine,
  providerProjectionAuditOverviewPeriodLine,
  providerProjectionAuditPurgeCanApply,
  providerProjectionAuditPurgeFromError,
  providerProjectionAuditPurgeInput,
  providerProjectionAuditPurgeLine,
  providerProjectionAuditPurgePermissionLine,
  providerProjectionAuditPurgePolicyLine,
  providerProjectionAuditQuery,
  providerProjectionAuditSummaryQuery,
  providerProjectionAuditStatusLabel,
  providerProjectionAuditSummaryLine,
  providerProjectionAuditTimeLabel,
  providerProjectionApplicableCount,
  providerProjectionCanApply,
  providerProjectionChangeLabel,
  providerProjectionDiffPreview,
  providerProjectionDiffKey,
  providerProjectionDiffLineKind,
  providerProjectionDiffReview,
  providerProjectionDiffToggleLabel,
  providerProjectionFileLine,
  providerProjectionItems,
  providerProjectionManualDriftCount,
  providerProjectionSummaryLine,
} from '../lib/memoryProviderProjection'
import type {
  AtlasMemoryProviderProjection,
  AtlasMemoryProviderProjectionAudit,
  AtlasMemoryProviderProjectionAuditPurge,
  AtlasMemoryProviderProjectionAuditSummary,
} from '../lib/api/client'

const projection: AtlasMemoryProviderProjection = {
  status: 'needs_review',
  summary: {
    create: 1,
    update: 1,
    manual_drift: 0,
  },
  projections: [
    {
      target: 'claude',
      path: '/tmp/CLAUDE.md',
      change_type: 'create',
      memory_count: 2,
      diff_line_count: 4,
      diff: [
        '--- /tmp/CLAUDE.md',
        '+++ /tmp/CLAUDE.md',
        '+# Atlas',
        '+Use registry memory.',
      ].join('\n'),
    },
    {
      target: 'agents',
      path: '/tmp/AGENTS.md',
      stale: true,
    },
  ],
}

assert.equal(providerProjectionApplicableCount(projection.summary), 2)
assert.equal(providerProjectionManualDriftCount(projection.summary), 0)
assert.equal(providerProjectionCanApply(projection, true), true)
assert.equal(providerProjectionCanApply(projection, false), false)
assert.equal(providerProjectionItems(projection).length, 2)
assert.equal(providerProjectionSummaryLine(projection.summary), '1 criação · 1 atualização')
assert.equal(providerProjectionChangeLabel(projection.projections?.[1] ?? { target: 'agents', path: null }), 'stale')
assert.equal(providerProjectionFileLine(projection.projections?.[0] ?? { target: 'claude', path: null }), 'create · 2 memória(s) · diff 4 · /tmp/CLAUDE.md')

const preview = providerProjectionDiffPreview(projection.projections?.[0] ?? { target: 'claude', path: null }, 2)
assert.deepEqual(preview.lines, ['--- /tmp/CLAUDE.md', '+++ /tmp/CLAUDE.md'])
assert.equal(preview.hidden, 2)

const collapsedReview = providerProjectionDiffReview(projection.projections?.[0] ?? { target: 'claude', path: null }, false)
assert.equal(collapsedReview.lines.length, 4)
assert.equal(collapsedReview.hidden, 0)
assert.equal(collapsedReview.key, 'claude:/tmp/CLAUDE.md:create:4')
assert.equal(providerProjectionDiffKey({ target: 'agents', path: null, change_type: 'manual_drift' }), 'agents:manual_drift')
assert.equal(providerProjectionDiffToggleLabel(false, 3), 'Expandir')
assert.equal(providerProjectionDiffToggleLabel(true, 0), 'Recolher')
assert.equal(providerProjectionDiffToggleLabel(false, 0), 'Completo')
assert.equal(providerProjectionDiffLineKind('+new line'), 'addition')
assert.equal(providerProjectionDiffLineKind('-old line'), 'removal')
assert.equal(providerProjectionDiffLineKind('@@ -1 +1 @@'), 'hunk')
assert.equal(providerProjectionDiffLineKind('--- old'), 'file')
assert.equal(providerProjectionDiffLineKind(' unchanged'), 'context')

const largeDiff = {
  target: 'claude',
  path: '/tmp/CLAUDE.md',
  change_type: 'update',
  diff: Array.from({ length: 14 }, (_, index) => `+line ${index + 1}`).join('\n'),
}
const largeCollapsed = providerProjectionDiffReview(largeDiff, false)
const largeExpanded = providerProjectionDiffReview(largeDiff, true)
assert.equal(largeCollapsed.lines.length, 10)
assert.equal(largeCollapsed.hidden, 4)
assert.equal(largeExpanded.lines.length, 14)
assert.equal(largeExpanded.hidden, 0)

const blocked: AtlasMemoryProviderProjection = {
  status: 'needs_review',
  summary: { applicable: 1, blocked: 1 },
}
assert.equal(providerProjectionCanApply(blocked, true), false)

const audit: AtlasMemoryProviderProjectionAudit = {
  id: 'audit-1',
  action: 'apply',
  target: 'claude',
  workspace: '/tmp/atlas',
  initiator: 'api',
  confirmation_mode: 'api_confirm',
  status: 'passed',
  ok: true,
  summary: { applied: 1 },
  applied: [
    {
      target: 'claude',
      path: '/tmp/atlas/CLAUDE.md',
      change_type: 'update',
      memory_count: 3,
      written: true,
    },
  ],
  blocked: [],
  failed: [],
  review_summary: { update: 1 },
  metadata: {},
  applied_at: '2026-05-02T10:30:00.000000Z',
  created_at: '2026-05-02T10:30:00.000000Z',
}

assert.equal(providerProjectionAuditStatusLabel(audit), 'aplicado')
assert.equal(providerProjectionAuditSummaryLine(audit), '1 aplicado')
assert.equal(providerProjectionAuditItems(audit).length, 1)
assert.equal(providerProjectionAuditMetaLine(audit), 'api · api_confirm · 02/05 10:30')
assert.equal(providerProjectionAuditTimeLabel(null), 'sem data')

const driftAudit: AtlasMemoryProviderProjectionAudit = {
  ...audit,
  id: 'audit-2',
  ok: false,
  status: 'needs_review',
  summary: { blocked: 1, manual_drift: 1 },
  applied: [],
  blocked: [{ target: 'agents', path: '/tmp/atlas/AGENTS.md', change_type: 'manual_drift' }],
}

assert.equal(providerProjectionAuditStatusLabel(driftAudit), 'bloqueado por drift')
assert.equal(providerProjectionAuditSummaryLine(driftAudit), '1 drift manual · 1 bloqueado')
assert.equal(providerProjectionAuditStatusLabel({ ...driftAudit, summary: { blocked: 1 } }), 'bloqueado')
assert.deepEqual(providerProjectionAuditQuery('claude', 'applied', 'api', 8), {
  target: 'claude',
  limit: 8,
  ok: true,
  initiator: 'api',
})
assert.deepEqual(providerProjectionAuditQuery('all', 'blocked', 'all'), {
  target: 'all',
  limit: 5,
  ok: false,
})
assert.equal(providerProjectionAuditFilterLine('blocked', 'cli'), 'Bloqueados · CLI')

assert.deepEqual(providerProjectionAuditSummaryQuery('agents', 'all', 'cli', 14), {
  target: 'agents',
  initiator: 'cli',
  days: 14,
})
assert.deepEqual(providerProjectionAuditPurgeInput('all', 'blocked', 'api', true, false, 120), {
  target: 'all',
  ok: false,
  initiator: 'api',
  older_than_days: 120,
  dry_run: true,
  confirm: false,
})
assert.deepEqual(providerProjectionAuditPurgeInput('all', 'blocked', 'api', false, true, 120, 'abc123'), {
  target: 'all',
  ok: false,
  initiator: 'api',
  older_than_days: 120,
  dry_run: false,
  confirm: true,
  confirmation_fingerprint: 'abc123',
})

const summary: AtlasMemoryProviderProjectionAuditSummary = {
  ok: true,
  period_days: 30,
  since_at: '2026-04-02T10:30:00.000000Z',
  generated_at: '2026-05-02T10:30:00.000000Z',
  total: 3,
  applied: 2,
  blocked: 1,
  by_target: {},
  by_initiator: {},
  latest_at: '2026-05-02T10:30:00.000000Z',
  oldest_at: '2026-04-29T10:30:00.000000Z',
}
assert.equal(providerProjectionAuditOverviewLine(summary), '3 evento(s) · 2 aplicado(s) · 1 bloqueado(s)')
assert.equal(providerProjectionAuditOverviewPeriodLine(summary), '30 dias · desde 02/04 10:30')

const purge: AtlasMemoryProviderProjectionAuditPurge = {
  ok: true,
  dry_run: true,
  older_than_days: 90,
  cutoff_at: '2026-02-01T10:30:00.000000Z',
  matched: 4,
  deleted: 0,
  confirmation_fingerprint: 'dry-run-fingerprint',
  filters: { target: 'all' },
  policy: { authorized: true, requires_operator: false, mode: 'atlas_token', header: 'X-Atlas-Operator' },
}
const operatorRequiredPurge: AtlasMemoryProviderProjectionAuditPurge = {
  ok: false,
  status: 'operator_permission_required',
  dry_run: false,
  older_than_days: 90,
  deleted: 0,
  policy: { authorized: false, requires_operator: true, mode: 'operator_header', header: 'X-Atlas-Operator' },
}
assert.equal(providerProjectionAuditPurgeLine(null), 'Simulação padrão: 90 dias')
assert.equal(providerProjectionAuditPurgeLine(purge), 'simulação · 4 encontrado(s) · 0 removido(s)')
assert.equal(providerProjectionAuditPurgeLine({ ...purge, dry_run: false, deleted: 4 }), 'remoção · 4 encontrado(s) · 4 removido(s)')
assert.equal(providerProjectionAuditPurgeLine(operatorRequiredPurge), 'remoção · 0 encontrado(s) · 0 removido(s)')
assert.equal(providerProjectionAuditPurgeCanApply(purge, 'all', 'all', 'all'), true)
assert.equal(providerProjectionAuditPurgeCanApply({ ...purge, matched: 0 }, 'all', 'all', 'all'), false)
assert.equal(providerProjectionAuditPurgeCanApply({ ...purge, filters: { target: 'agents' } }, 'all', 'all', 'all'), false)
assert.equal(providerProjectionAuditPurgeCanApply({ ...purge, dry_run: false }, 'all', 'all', 'all'), false)
assert.equal(providerProjectionAuditPurgeCanApply({ ...purge, confirmation_fingerprint: '' }, 'all', 'all', 'all'), false)
assert.equal(providerProjectionAuditPurgeCanApply(operatorRequiredPurge, 'all', 'all', 'all'), false)
assert.equal(providerProjectionAuditPurgePolicyLine(null, 'all', 'all', 'all'), 'Simule antes de aplicar')
assert.equal(providerProjectionAuditPurgePolicyLine(operatorRequiredPurge, 'all', 'all', 'all'), 'Operador requerido (X-Atlas-Operator)')
assert.equal(providerProjectionAuditPurgePolicyLine({ ...purge, filters: { target: 'agents' } }, 'all', 'all', 'all'), 'Filtros mudaram; simule novamente')
assert.equal(providerProjectionAuditPurgePolicyLine({ ...purge, confirmation_fingerprint: '' }, 'all', 'all', 'all'), 'Dry-run antigo; simule novamente')
assert.equal(providerProjectionAuditPurgePolicyLine({ ...purge, matched: 0 }, 'all', 'all', 'all'), 'Nenhuma auditoria antiga encontrada')
assert.equal(providerProjectionAuditPurgePolicyLine({ ...purge, dry_run: false }, 'all', 'all', 'all'), 'Simule novamente apos remocao')
assert.equal(providerProjectionAuditPurgePolicyLine(purge, 'all', 'all', 'all'), 'Dry-run valido para aplicar')
assert.equal(providerProjectionAuditPurgePermissionLine(null), 'Permissao backend nao informada')
assert.equal(providerProjectionAuditPurgePermissionLine(purge), 'Token Atlas autorizado')
assert.equal(providerProjectionAuditPurgePermissionLine(operatorRequiredPurge), 'Operador requerido (X-Atlas-Operator)')
assert.equal(providerProjectionAuditPurgePermissionLine({ ...operatorRequiredPurge, policy: { ...operatorRequiredPurge.policy!, authorized: true } }), 'Operador autorizado (operator_header)')
assert.equal(providerProjectionAuditPurgeFromError({ payload: { provider_projection_audit_purge: operatorRequiredPurge } })?.status, 'operator_permission_required')
assert.equal(providerProjectionAuditPurgeFromError(new Error('plain')), null)

console.log('memory provider projection tests passed')
