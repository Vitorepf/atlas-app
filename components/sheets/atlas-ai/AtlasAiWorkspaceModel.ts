import type { AtlasAiThread, AtlasAiTrace } from '../../../lib/api/client'

export interface AtlasAiWorkspaceContextSummary {
  workspace: string | null
  lockStatus: 'locked' | 'unscoped'
  handoffStatus: string | null
  handoffHash: string | null
  requiredArtifacts: string[]
  missingArtifacts: string[]
  fusionStatus: string | null
  fusionHash: string | null
  rawConversationReturned: boolean | null
}

export function workspaceContextFromThreadAndTrace(
  thread: AtlasAiThread | null,
  trace: AtlasAiTrace | null,
): AtlasAiWorkspaceContextSummary | null {
  const metadata = trace?.metadata ?? {}
  const workspace = firstString([
    thread?.workspace,
    metadata.workspace_slug,
    metadata.workspace,
    nested(metadata, ['payload', 'workspace_slug']),
    nested(metadata, ['payload', 'workspace']),
  ])
  const handoff = firstRecord([
    nested(metadata, ['atlas_dev_runtime', 'workspace_handoff_pack']),
    nested(metadata, ['atlas_forge_runtime', 'workspace_handoff_pack']),
    metadata.workspace_handoff_pack,
    metadata.handoff_pack,
  ])
  const fusion = firstRecord([
    metadata.conversation_fusion,
    metadata.workspace_conversation_fusion,
    nested(metadata, ['payload', 'conversation_fusion']),
  ])
  if (!workspace && !handoff && !fusion) return null

  return {
    workspace,
    lockStatus: workspace ? 'locked' : 'unscoped',
    handoffStatus: stringValue(handoff?.status),
    handoffHash: firstString([
      handoff?.handoff_hash,
      handoff?.hash,
      nested(handoff, ['workspace_handoff_pack', 'handoff_hash']),
    ]),
    requiredArtifacts: stringList(handoff?.required_artifacts),
    missingArtifacts: stringList(handoff?.missing_artifacts),
    fusionStatus: stringValue(fusion?.status),
    fusionHash: firstString([
      fusion?.fusion_hash,
      nested(fusion, ['fusion_pack', 'fusion_pack_hash']),
    ]),
    rawConversationReturned: booleanValue(
      nested(fusion, ['source_policy', 'raw_conversation_returned']),
    ),
  }
}

function nested(value: unknown, path: string[]): unknown {
  let curr = value
  for (const key of path) {
    if (!curr || typeof curr !== 'object' || !(key in curr)) return undefined
    curr = (curr as Record<string, unknown>)[key]
  }
  return curr
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    const str = stringValue(value)
    if (str) return str
  }
  return null
}

function firstRecord(values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}
