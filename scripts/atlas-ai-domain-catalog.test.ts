import assert from 'node:assert/strict'
import {
  domainCatalogReadyFlows,
  selectAtlasAiDomainFlow,
} from '../lib/atlasAiDomainCatalog'
import type { AtlasAiDomainCatalogResponse } from '../lib/api/client'

const catalog: AtlasAiDomainCatalogResponse = {
  schema_version: 1,
  status: 'ok',
  source: 'fixture',
  filters: { domain: null, flow: null, maturity: null },
  summary: {
    domains: 3,
    flows: 4,
    orchestrators: 3,
    implemented_orchestrators: 2,
    scaffold_orchestrators: 1,
    planned_orchestrators: 0,
    ready_domains: 2,
    executable_incomplete_domains: 0,
  },
  domains: [
    {
      id: 'general',
      label: 'General',
      default_flow: 'general.answer',
      orchestrator: 'StandardResponseOrchestrator',
      orchestrator_maturity: 'scaffold',
      runtime_family: 'conversation',
      autonomy_default: 'low',
      background_allowed: false,
      flow_count: 1,
      onboarding: { status: 'scaffold', completed_count: 4, total_count: 9, completed_phases: [], missing_phases: [] },
    },
    {
      id: 'programming',
      label: 'Programming',
      default_flow: 'programming.dev',
      orchestrator: 'AtlasProgrammingOrchestrator',
      orchestrator_maturity: 'implemented',
      runtime_family: 'engineering',
      autonomy_default: 'medium',
      background_allowed: false,
      flow_count: 2,
      onboarding: { status: 'ready', completed_count: 9, total_count: 9, completed_phases: [], missing_phases: [] },
    },
    {
      id: 'marketing',
      label: 'Marketing',
      default_flow: 'marketing.campaign',
      orchestrator: 'AtlasMarketingOrchestrator',
      orchestrator_maturity: 'implemented',
      runtime_family: 'marketing',
      autonomy_default: 'medium',
      background_allowed: false,
      flow_count: 1,
      onboarding: { status: 'ready', completed_count: 9, total_count: 9, completed_phases: [], missing_phases: [] },
    },
  ],
  flows: [
    {
      id: 'general.answer',
      domain_id: 'general',
      label: 'Answer',
      runtime: 'StandardAiResponse',
      orchestrator: 'StandardResponseOrchestrator',
      orchestrator_maturity: 'scaffold',
      autonomy: 'low',
      background_allowed: false,
      destructive_requires_approval: true,
      executor_preference: '',
    },
    {
      id: 'programming.dev',
      domain_id: 'programming',
      label: 'Dev',
      runtime: 'ProviderExecution',
      orchestrator: 'AtlasProgrammingOrchestrator',
      orchestrator_maturity: 'implemented',
      autonomy: 'medium',
      background_allowed: false,
      destructive_requires_approval: true,
      executor_preference: 'simple_provider_execution',
    },
    {
      id: 'programming.repair',
      domain_id: 'programming',
      label: 'Repair',
      runtime: 'ProviderExecution',
      orchestrator: 'AtlasProgrammingOrchestrator',
      orchestrator_maturity: 'implemented',
      autonomy: 'medium',
      background_allowed: false,
      destructive_requires_approval: true,
      executor_preference: 'dev_repair_executor',
    },
    {
      id: 'marketing.campaign',
      domain_id: 'marketing',
      label: 'Campaign',
      runtime: 'MarketingRuntime',
      orchestrator: 'AtlasMarketingOrchestrator',
      orchestrator_maturity: 'implemented',
      autonomy: 'medium',
      background_allowed: false,
      destructive_requires_approval: true,
      executor_preference: 'domain_runtime',
    },
  ],
  orchestrators: [],
  validation: { valid: true, errors: [], warnings: [] },
  generated_at: '2026-05-05T12:00:00.000Z',
}

{
  const selection = selectAtlasAiDomainFlow(catalog, {
    surface_id: 'atlas_app',
    mode: 'programming',
    task: 'debug',
    routing_domain: 'blackink',
  })

  assert.equal(selection.status, 'ok')
  assert.equal(selection.selection_source, 'ux_mapping')
  assert.equal(selection.ux.product_domain, 'blackink')
  assert.equal(selection.domain?.id, 'programming')
  assert.equal(selection.flow?.id, 'programming.repair')
  assert.equal(selection.flow?.executor_preference, 'dev_repair_executor')
  assert.equal(selection.safety?.ready, true)
  assert.equal(selection.payload_patch.flow_id, 'programming.repair')
}

{
  const selection = selectAtlasAiDomainFlow(catalog, {
    surface_id: 'atlas_app',
    mode: 'general',
    task: 'direct',
    domain_id: 'marketing',
  })

  assert.equal(selection.status, 'ok')
  assert.equal(selection.selection_source, 'explicit_domain')
  assert.equal(selection.domain?.id, 'marketing')
  assert.equal(selection.flow?.id, 'marketing.campaign')
  assert.equal(selection.flow?.executor_preference, 'domain_runtime')
}

{
  const selection = selectAtlasAiDomainFlow(catalog, {
    surface_id: 'atlas_app',
    mode: 'programming',
    task: 'dev',
    flow_id: 'programming.unknown',
  })

  assert.equal(selection.status, 'unresolved')
  assert.equal(selection.selection_source, 'explicit_flow')
  assert.equal(selection.requested?.flow_id, 'programming.unknown')
  assert.equal(selection.payload_patch.flow_id, null)
}

{
  assert.deepEqual(domainCatalogReadyFlows(catalog).map((flow) => flow.id), [
    'programming.dev',
    'programming.repair',
    'marketing.campaign',
  ])
}

console.info('atlas ai domain catalog tests passed')
