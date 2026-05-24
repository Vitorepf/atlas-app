import type { AtlasAiThread, AtlasWorkspaceProfile } from '../../../lib/api/client'

export const ATLAS_AI_MOBILE_WORKSPACE_STORAGE_KEY = 'atlas-ai.mobile.active-workspace-slug'

export interface AtlasAiMobileWorkspaceLock {
  workspaceSlug: string | null
  workspaceName: string | null
  workspacePath: string | null
  locked: boolean
  lockReason: 'thread' | 'pending_conversation' | 'draft_selection' | 'default' | 'none'
  profile: AtlasWorkspaceProfile | null
}

export function resolveMobileWorkspaceLock(input: {
  thread: AtlasAiThread | null
  profiles: AtlasWorkspaceProfile[]
  defaultSlug: string | null
  selectedSlug: string | null
  conversationStarted: boolean
}): AtlasAiMobileWorkspaceLock {
  const threadWorkspace = clean(input.thread?.workspace)
  if (threadWorkspace) {
    const profile = findWorkspaceProfile(input.profiles, threadWorkspace)
    return buildLock(profile, threadWorkspace, true, 'thread')
  }

  const selected = clean(input.selectedSlug)
  if (selected) {
    const profile = findWorkspaceProfile(input.profiles, selected)
    return buildLock(profile, selected, input.conversationStarted, input.conversationStarted ? 'pending_conversation' : 'draft_selection')
  }

  const fallback = clean(input.defaultSlug)
  if (fallback) {
    const profile = findWorkspaceProfile(input.profiles, fallback)
    return buildLock(profile, fallback, input.conversationStarted, input.conversationStarted ? 'pending_conversation' : 'default')
  }

  return {
    workspaceSlug: null,
    workspaceName: null,
    workspacePath: null,
    locked: input.conversationStarted,
    lockReason: 'none',
    profile: null,
  }
}

export function mobileWorkspacePayload(lock: AtlasAiMobileWorkspaceLock): Record<string, unknown> {
  if (!lock.workspaceSlug) return {}

  return {
    workspace_slug: lock.workspaceSlug,
    workspace_name: lock.workspaceName ?? lock.workspaceSlug,
    workspace_path: lock.workspacePath ?? undefined,
    awis_mobile_workspace_scope: {
      schema_version: 'atlas.mobile_ai.workspace_scope.v1',
      workspace_slug: lock.workspaceSlug,
      workspace_path_present: lock.workspacePath !== null,
      locked_for_conversation: lock.locked,
      lock_reason: lock.lockReason,
    },
  }
}

export function workspacePickerOptions(profiles: AtlasWorkspaceProfile[], query: string): AtlasWorkspaceProfile[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return profiles

  return profiles.filter((profile) =>
    [profile.slug, profile.name, profile.workspace_path, profile.stack_summary]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .some((value) => value.toLowerCase().includes(needle)),
  )
}

function buildLock(
  profile: AtlasWorkspaceProfile | null,
  fallbackSlug: string,
  locked: boolean,
  lockReason: AtlasAiMobileWorkspaceLock['lockReason'],
): AtlasAiMobileWorkspaceLock {
  return {
    workspaceSlug: profile?.slug ?? fallbackSlug,
    workspaceName: profile?.name ?? fallbackSlug,
    workspacePath: clean(profile?.workspace_path) ?? clean(profile?.repo_root),
    locked,
    lockReason,
    profile,
  }
}

function findWorkspaceProfile(profiles: AtlasWorkspaceProfile[], slugOrPath: string): AtlasWorkspaceProfile | null {
  return profiles.find((profile) =>
    profile.slug === slugOrPath
    || profile.workspace_path === slugOrPath
    || profile.repo_root === slugOrPath
  ) ?? null
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
