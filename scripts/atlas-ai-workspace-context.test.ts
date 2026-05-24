import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { workspaceContextFromThreadAndTrace } from '../components/sheets/atlas-ai/AtlasAiWorkspaceModel'
import type { AtlasAiThread, AtlasAiTrace } from '../lib/api/client'

const root = process.cwd()
const contextSheet = readFileSync(
  join(root, 'components', 'sheets', 'atlas-ai', 'AtlasAiContextSheet.tsx'),
  'utf8',
)

const baseThread = {
  id: 'thread_1',
  title: 'Corrigir login',
  workspace: 'atlas',
  metadata: {},
} as AtlasAiThread

const baseTrace = {
  id: 'trace_1',
  metadata: {},
} as AtlasAiTrace

{
  const summary = workspaceContextFromThreadAndTrace(baseThread, {
    ...baseTrace,
    metadata: {
      atlas_dev_runtime: {
        workspace_handoff_pack: {
          status: 'ready',
          handoff_hash: 'abcdef1234567890',
          required_artifacts: ['workspace_brief', 'task_packet'],
          missing_artifacts: [],
        },
      },
    },
  })
  assert.equal(summary?.workspace, 'atlas')
  assert.equal(summary?.lockStatus, 'locked')
  assert.equal(summary?.handoffStatus, 'ready')
  assert.equal(summary?.handoffHash, 'abcdef1234567890')
  assert.deepEqual(summary?.requiredArtifacts, ['workspace_brief', 'task_packet'])
}

{
  const summary = workspaceContextFromThreadAndTrace(null, {
    ...baseTrace,
    metadata: {
      workspace_slug: 'blackink',
      conversation_fusion: {
        status: 'ready',
        fusion_pack: { fusion_pack_hash: 'fusionhash123456' },
        source_policy: { raw_conversation_returned: false },
      },
    },
  })
  assert.equal(summary?.workspace, 'blackink')
  assert.equal(summary?.fusionStatus, 'ready')
  assert.equal(summary?.fusionHash, 'fusionhash123456')
  assert.equal(summary?.rawConversationReturned, false)
}

{
  const summary = workspaceContextFromThreadAndTrace(null, baseTrace)
  assert.equal(summary, null)
}

assert.match(
  contextSheet,
  /workspace AWIS/,
  'Mobile ContextSheet must expose AWIS workspace scope in the audit sheet',
)
assert.match(
  contextSheet,
  /fixo nesta conversa/,
  'Mobile ContextSheet must surface that the workspace is locked for the conversation',
)
assert.match(
  contextSheet,
  /artefatos necessários/,
  'Mobile ContextSheet must show provider-safe AWIS handoff artifact requirements',
)
