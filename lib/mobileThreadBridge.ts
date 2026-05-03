export interface MobileThreadBridgeInput {
  threadId?: string | null
  inboxId?: string | null
  action?: string | null
}

export type DiscussInboxItem = (id: string) => Promise<{ result: Record<string, unknown> }>

export async function resolveMobileThreadBridgeTarget(
  input: MobileThreadBridgeInput,
  discussInboxItem: DiscussInboxItem,
): Promise<string | null> {
  const directThreadId = cleanString(input.threadId)
  if (directThreadId) return directThreadId

  const inboxId = cleanString(input.inboxId)
  const action = cleanString(input.action)
  if (inboxId && action === 'discuss') {
    const response = await discussInboxItem(inboxId)
    const threadId = threadIdFromMobileThreadActionResult(response.result)
    if (!threadId) {
      throw new Error('Atlas nao recebeu a conversa operacional deste item.')
    }

    return threadId
  }

  return null
}

export function threadIdFromMobileThreadActionResult(result: Record<string, unknown>): string | null {
  const direct = result.thread_id
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim()

  const nested = result.thread
  if (nested && typeof nested === 'object') {
    const id = (nested as Record<string, unknown>).id
    if (typeof id === 'string' && id.trim().length > 0) return id.trim()
  }

  return null
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}
