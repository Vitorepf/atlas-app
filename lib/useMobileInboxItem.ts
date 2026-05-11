import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getMobileInboxItem,
  markMobileInboxRead,
  respondMobileInboxItem,
  snoozeMobileInboxItem,
  type AtlasOperationalInboxItem,
} from './api/client'
import {
  actionMessage,
  daysFromNowIso,
  threadIdFromActionResult,
  type AtlasInboxAction,
} from './mobileInboxItemModels'

interface UseMobileInboxItemParams {
  inboxId: string | null
  initialAction: string | null
  onClose: () => void
  openAtlasAi: (threadId?: string | null) => void
  showToast: (message: string) => void
}

export function useMobileInboxItem({
  inboxId,
  initialAction,
  onClose,
  openAtlasAi,
  showToast,
}: UseMobileInboxItemParams) {
  const initialActionHandled = useRef(false)
  const loadSeq = useRef(0)
  const [item, setItem] = useState<AtlasOperationalInboxItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null)
  const [snoozeAction, setSnoozeAction] = useState<AtlasInboxAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = useMemo(() => item?.available_actions ?? [], [item?.available_actions])

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const seq = loadSeq.current + 1
    loadSeq.current = seq

    if (!inboxId) {
      if (seq !== loadSeq.current) return
      setError('Item do inbox nao informado.')
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    setError(null)
    try {
      const response = await getMobileInboxItem(inboxId)
      if (seq !== loadSeq.current) return
      let nextItem = response.item
      if (nextItem.status === 'unread') {
        const readResponse = await markMobileInboxRead(inboxId).catch(() => null)
        if (seq !== loadSeq.current) return
        nextItem = readResponse?.item ?? nextItem
      }
      setItem(nextItem)
    } catch (caught) {
      if (seq !== loadSeq.current) return
      setError(caught instanceof Error ? caught.message : 'Falha ao carregar item do inbox.')
    } finally {
      if (seq === loadSeq.current && !silent) setLoading(false)
    }
  }, [inboxId])

  useEffect(() => {
    void load()
  }, [load])

  const runDiscuss = useCallback(async (targetItem: AtlasOperationalInboxItem) => {
    setBusyActionId('discuss')
    setError(null)
    try {
      const response = await discussMobileInboxItem(targetItem.id)
      setItem(response.item)
      const threadId = threadIdFromActionResult(response.result)
      if (threadId) {
        openAtlasAi(threadId)
      } else {
        showToast('Atlas aberto')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao abrir Atlas.')
    } finally {
      setBusyActionId(null)
    }
  }, [openAtlasAi, showToast])

  useEffect(() => {
    if (initialActionHandled.current || loading || !item || initialAction !== 'discuss') return
    initialActionHandled.current = true
    void runDiscuss(item)
  }, [initialAction, item, loading, runDiscuss])

  const requestAction = useCallback(async (action: AtlasInboxAction) => {
    if (!item || busyActionId) return

    if (action.id === 'snooze') {
      setConfirmingActionId(null)
      setSnoozeAction(action)
      return
    }

    if (action.requires_confirm && confirmingActionId !== action.id) {
      setConfirmingActionId(action.id)
      return
    }

    setConfirmingActionId(null)
    setBusyActionId(action.id)
    setError(null)
    try {
      if (action.id === 'dismiss' || action.id === 'discard') {
        const response = await dismissMobileInboxItem(item.id, `Acao ${action.id} pelo app.`)
        setItem(response.item)
        showToast('item descartado')
        onClose()
        return
      }

      if (action.id === 'discuss') {
        await runDiscuss(item)
        return
      }

      const response = await respondMobileInboxItem(item.id, action.id)
      setItem(response.item)
      showToast(actionMessage(action.id, response.result))
      await load({ silent: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao aplicar acao.')
    } finally {
      setBusyActionId(null)
    }
  }, [busyActionId, confirmingActionId, item, load, onClose, runDiscuss, showToast])

  const runSnooze = useCallback(async (days: number, reason: string) => {
    if (!item || busyActionId) return

    setBusyActionId('snooze')
    setError(null)
    try {
      const response = await snoozeMobileInboxItem(item.id, daysFromNowIso(days), reason)
      setItem(response.item)
      setSnoozeAction(null)
      showToast(days === 1 ? 'item adiado para amanha' : `item adiado por ${days} dias`)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao adiar item.')
    } finally {
      setBusyActionId(null)
    }
  }, [busyActionId, item, onClose, showToast])

  return {
    actions,
    busyActionId,
    confirmingActionId,
    error,
    item,
    load,
    loading,
    requestAction,
    runSnooze,
    setSnoozeAction,
    snoozeAction,
  }
}
