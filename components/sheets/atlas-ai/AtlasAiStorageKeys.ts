export const ROUTING_KEY = 'atlas-ai.routing'
export const THREAD_PAGE_SIZE = 10
export const PENDING_SUBMISSION_RETRY_DELAY_MS = 8_000

const PINNED_TRACE_KEY_PREFIX = 'atlas-ai.pinned-traces.'

export function pinnedTraceStorageKey(threadId: string): string {
  return `${PINNED_TRACE_KEY_PREFIX}${threadId}`
}
