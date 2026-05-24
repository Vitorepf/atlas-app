import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ATLAS_AI_MOBILE_WORKSPACE_STORAGE_KEY,
  mobileWorkspacePayload,
  resolveMobileWorkspaceLock,
  workspacePickerOptions,
} from '../components/sheets/atlas-ai/AtlasAiMobileWorkspaceModel'
import type { AtlasAiThread, AtlasWorkspaceProfile } from '../lib/api/client'

const profiles: AtlasWorkspaceProfile[] = [
  {
    slug: 'atlas',
    name: 'Atlas',
    workspace_path: '/Users/vitorepf/develop/Atlas',
    stack_summary: 'Laravel Expo Tauri',
  },
  {
    slug: 'blackink',
    name: 'blackink',
    workspace_path: '/Users/vitorepf/develop/blackink',
    stack_summary: 'commerce',
  },
]

{
  const lock = resolveMobileWorkspaceLock({
    thread: null,
    profiles,
    defaultSlug: 'atlas',
    selectedSlug: null,
    conversationStarted: false,
  })
  assert.equal(lock.workspaceSlug, 'atlas')
  assert.equal(lock.workspaceName, 'Atlas')
  assert.equal(lock.locked, false)
  assert.equal(lock.lockReason, 'default')
}

{
  const lock = resolveMobileWorkspaceLock({
    thread: null,
    profiles,
    defaultSlug: 'atlas',
    selectedSlug: 'blackink',
    conversationStarted: true,
  })
  assert.equal(lock.workspaceSlug, 'blackink')
  assert.equal(lock.locked, true)
  assert.equal(lock.lockReason, 'pending_conversation')
}

{
  const thread = {
    id: 'thread_1',
    title: 'Corrigir checkout',
    workspace: '/Users/vitorepf/develop/blackink',
    metadata: {},
  } as AtlasAiThread
  const lock = resolveMobileWorkspaceLock({
    thread,
    profiles,
    defaultSlug: 'atlas',
    selectedSlug: 'atlas',
    conversationStarted: false,
  })
  assert.equal(lock.workspaceSlug, 'blackink')
  assert.equal(lock.locked, true)
  assert.equal(lock.lockReason, 'thread')
}

{
  const lock = resolveMobileWorkspaceLock({
    thread: null,
    profiles,
    defaultSlug: null,
    selectedSlug: 'atlas',
    conversationStarted: true,
  })
  const payload = mobileWorkspacePayload(lock)
  assert.equal(payload.workspace_slug, 'atlas')
  assert.equal((payload.awis_mobile_workspace_scope as Record<string, unknown>).schema_version, 'atlas.mobile_ai.workspace_scope.v1')
  assert.equal((payload.awis_mobile_workspace_scope as Record<string, unknown>).locked_for_conversation, true)
}

{
  const result = workspacePickerOptions(profiles, 'commerce')
  assert.equal(result.length, 1)
  assert.equal(result[0].slug, 'blackink')
}

const root = process.cwd()
const sheet = readFileSync(join(root, 'components', 'sheets', 'AtlasAiSheet.tsx'), 'utf8')
const footer = readFileSync(join(root, 'components', 'sheets', 'atlas-ai', 'AtlasAiComposerFooter.tsx'), 'utf8')
const workspaceSheet = readFileSync(join(root, 'components', 'sheets', 'atlas-ai', 'AtlasAiWorkspaceSheet.tsx'), 'utf8')

assert.equal(
  ATLAS_AI_MOBILE_WORKSPACE_STORAGE_KEY,
  'atlas-ai.mobile.active-workspace-slug',
)
assert.match(sheet, /listAtlasWorkspaceProfiles/, 'Mobile Atlas AI must fetch workspace profiles from backend')
assert.match(sheet, /createAtlasWorkspaceProfile/, 'Mobile Atlas AI must create workspace profiles from the selector')
assert.match(sheet, /resolveMobileWorkspaceLock/, 'Mobile Atlas AI must resolve workspace lock before submit')
assert.match(sheet, /mobileWorkspacePayload\(mobileWorkspaceLock\)/, 'Mobile Atlas AI must include AWIS workspace scope in payload')
assert.match(sheet, /workspaceSlug: mobileWorkspaceLock\.workspaceSlug \?\? null/, 'Mobile Atlas AI submit must use locked workspace slug')
assert.match(sheet, /Workspace fixo/, 'Mobile Atlas AI must block workspace changes after conversation starts')
assert.match(sheet, /<AtlasAiWorkspaceSheet/, 'Mobile Atlas AI must use a first-class workspace sheet instead of a native alert')
assert.match(footer, /workspaceLabel/, 'Mobile composer footer must expose selected workspace')
assert.match(footer, /workspaceLocked/, 'Mobile composer footer must expose locked workspace state')
assert.match(footer, /WORKSPACE/, 'Mobile composer footer must render a workspace affordance')
assert.match(workspaceSheet, /Escolher projeto/, 'Workspace sheet must expose a human-readable project selector')
assert.match(workspaceSheet, /workspacePickerOptions/, 'Workspace sheet must use canon picker filtering')
assert.match(workspaceSheet, /FIXO NESTA CONVERSA/, 'Workspace sheet must explain lock state after the conversation starts')
assert.match(workspaceSheet, /TextInput/, 'Workspace sheet must support search across projects')
assert.match(workspaceSheet, /ADICIONAR NOVO PROJETO/, 'Workspace sheet must expose add-project flow')
assert.match(workspaceSheet, /slugFromNameOrPath/, 'Workspace sheet must derive a stable slug for new projects')
