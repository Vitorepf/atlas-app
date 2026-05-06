import type {
  AtlasAiDomainCatalogDomain,
  AtlasAiDomainCatalogFlow,
  AtlasAiDomainCatalogResponse,
} from './api/client'

export interface AtlasAiSurfaceRoutingLike {
  mode?: string | null
  task?: string | null
  domain?: string | null
  routing_domain?: string | null
  domain_id?: string | null
  flow_id?: string | null
  surface_id?: string | null
}

export interface AtlasAiDomainFlowSelection {
  schema_version: 1
  status: 'ok' | 'unresolved'
  surface_id: string
  selection_source: 'ux_mapping' | 'explicit_domain' | 'explicit_flow'
  operator_override: boolean
  ux: {
    mode: 'general' | 'operational' | 'programming'
    task: 'direct' | 'plan' | 'review' | 'dev' | 'debug'
    product_domain: string | null
  }
  requested?: {
    domain_id: string | null
    flow_id: string | null
    resolved_flow_id: string
  }
  domain?: AtlasAiDomainCatalogDomain
  flow?: AtlasAiDomainCatalogFlow
  safety?: {
    ready: boolean
    onboarding_status: string
    autonomy: string
    background_allowed: boolean
    destructive_requires_approval: boolean
    surface_must_confirm_destructive: boolean
  }
  payload_patch: {
    domain_id: string | null
    flow_id: string | null
    surface_id: string
    catalog_schema_version: number
    selection_source: string
    product_domain: string | null
  }
}

const UX_FLOW_MAP: Record<string, Record<string, string>> = {
  general: {
    direct: 'general.answer',
    plan: 'general.answer',
    review: 'general.answer',
  },
  operational: {
    direct: 'operations.diagnostic',
    plan: 'operations.diagnostic',
    review: 'operations.diagnostic',
  },
  programming: {
    direct: 'programming.dev',
    plan: 'programming.dev',
    review: 'programming.review',
    dev: 'programming.dev',
    debug: 'programming.repair',
  },
}

export function selectAtlasAiDomainFlow(
  catalog: AtlasAiDomainCatalogResponse,
  input: AtlasAiSurfaceRoutingLike,
): AtlasAiDomainFlowSelection {
  const surfaceId = clean(input.surface_id) ?? 'atlas_app'
  const mode = normalizeMode(clean(input.mode))
  const task = normalizeTask(clean(input.task))
  const productDomain = productDomainFromInput(input)
  const requestedFlow = clean(input.flow_id)
  const requestedDomain = clean(input.domain_id)
  const domains = new Map(catalog.domains.map((domain) => [domain.id, domain]))
  const flows = new Map(catalog.flows.map((flow) => [flow.id, flow]))
  const flowId = requestedFlow
    ?? (requestedDomain ? domains.get(requestedDomain)?.default_flow : undefined)
    ?? flowFromUx(mode, task)
  const selectionSource = requestedFlow ? 'explicit_flow' : requestedDomain ? 'explicit_domain' : 'ux_mapping'
  const flow = flows.get(flowId)
  const domain = flow ? domains.get(flow.domain_id) : undefined

  if (!flow || !domain) {
    return {
      schema_version: 1,
      status: 'unresolved',
      surface_id: surfaceId,
      selection_source: selectionSource,
      operator_override: Boolean(requestedFlow || requestedDomain),
      ux: { mode, task, product_domain: productDomain },
      requested: {
        domain_id: requestedDomain ?? null,
        flow_id: requestedFlow ?? null,
        resolved_flow_id: flowId,
      },
      payload_patch: {
        domain_id: null,
        flow_id: null,
        surface_id: surfaceId,
        catalog_schema_version: catalog.schema_version,
        selection_source: 'unresolved',
        product_domain: productDomain,
      },
    }
  }

  return {
    schema_version: 1,
    status: 'ok',
    surface_id: surfaceId,
    selection_source: selectionSource,
    operator_override: Boolean(requestedFlow || requestedDomain),
    ux: { mode, task, product_domain: productDomain },
    domain,
    flow,
    safety: {
      ready: domain.onboarding.status === 'ready',
      onboarding_status: domain.onboarding.status,
      autonomy: flow.autonomy,
      background_allowed: flow.background_allowed,
      destructive_requires_approval: flow.destructive_requires_approval,
      surface_must_confirm_destructive: flow.destructive_requires_approval,
    },
    payload_patch: {
      domain_id: domain.id,
      flow_id: flow.id,
      surface_id: surfaceId,
      catalog_schema_version: catalog.schema_version,
      selection_source: selectionSource,
      product_domain: productDomain,
    },
  }
}

export function domainCatalogReadyFlows(catalog: AtlasAiDomainCatalogResponse): AtlasAiDomainCatalogFlow[] {
  const readyDomains = new Set(
    catalog.domains
      .filter((domain) => domain.onboarding.status === 'ready')
      .map((domain) => domain.id),
  )

  return catalog.flows.filter((flow) => readyDomains.has(flow.domain_id))
}

function flowFromUx(mode: string, task: string): string {
  return UX_FLOW_MAP[mode]?.[task] ?? UX_FLOW_MAP[mode]?.direct ?? 'general.answer'
}

function productDomainFromInput(input: AtlasAiSurfaceRoutingLike): string | null {
  const domain = clean(input.routing_domain) ?? clean(input.domain)
  if (!domain || ['auto', 'programming', 'marketing', 'self_improvement', 'general'].includes(domain)) return null
  return domain
}

function normalizeMode(value: string | null): 'general' | 'operational' | 'programming' {
  if (value === 'operational' || value === 'ops') return 'operational'
  if (value === 'programming' || value === 'programacao' || value === 'programação' || value === 'dev' || value === 'debug') return 'programming'
  return 'general'
}

function normalizeTask(value: string | null): 'direct' | 'plan' | 'review' | 'dev' | 'debug' {
  if (value === 'plan' || value === 'review' || value === 'dev' || value === 'debug' || value === 'direct') return value
  if (value === 'repair') return 'debug'
  return 'direct'
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}
