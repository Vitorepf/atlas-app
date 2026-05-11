import type { AtlasAiDomainFlowSelection } from '../../../lib/atlasAiDomainCatalog'

export function compactDomainSelectionPayloadPatch(
  patch: AtlasAiDomainFlowSelection['payload_patch'],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== null && value !== undefined),
  )
}

export function compactDomainSelectionForPayload(selection: AtlasAiDomainFlowSelection): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      schema_version: selection.schema_version,
      status: selection.status,
      surface_id: selection.surface_id,
      selection_source: selection.selection_source,
      operator_override: selection.operator_override,
      ux: selection.ux,
      requested: selection.requested,
      domain: selection.domain
        ? {
            id: selection.domain.id,
            label: selection.domain.label,
            default_flow: selection.domain.default_flow,
            orchestrator_maturity: selection.domain.orchestrator_maturity,
            runtime_family: selection.domain.runtime_family,
            autonomy_default: selection.domain.autonomy_default,
            background_allowed: selection.domain.background_allowed,
            onboarding: selection.domain.onboarding,
          }
        : undefined,
      flow: selection.flow
        ? {
            id: selection.flow.id,
            domain_id: selection.flow.domain_id,
            label: selection.flow.label,
            runtime: selection.flow.runtime,
            orchestrator_maturity: selection.flow.orchestrator_maturity,
            autonomy: selection.flow.autonomy,
            background_allowed: selection.flow.background_allowed,
            destructive_requires_approval: selection.flow.destructive_requires_approval,
            executor_preference: selection.flow.executor_preference,
          }
        : undefined,
      safety: selection.safety,
    }).filter(([, value]) => value !== undefined),
  )
}
