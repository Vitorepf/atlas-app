export const ROUTING_KEY = 'atlas-ai.routing'
export const COMPUTE_EFFORT_KEY = 'atlas-ai.compute-effort'
export const PENDING_SUBMISSION_KEY = 'atlas-ai.pending-submission'
export const THREAD_PAGE_SIZE = 10
export const PENDING_SUBMISSION_RETRY_DELAY_MS = 8_000
export const PENDING_SUBMISSION_STUCK_MS = 45_000
export const PENDING_SUBMISSION_MAX_RECOVERY_AGE_MS = 2 * 60_000
export const ACTIVE_TRACE_STUCK_MS = 3 * 60_000

const PINNED_TRACE_KEY_PREFIX = 'atlas-ai.pinned-traces.'

export function pinnedTraceStorageKey(threadId: string): string {
  return `${PINNED_TRACE_KEY_PREFIX}${threadId}`
}
