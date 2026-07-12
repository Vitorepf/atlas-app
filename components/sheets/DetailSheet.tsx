import { useMemo } from 'react'
import { BottomSheet } from './BottomSheet'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'
import { domainLabel } from '../../lib/domains'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../../lib/atlasStore'
import { triageSuccessMessage } from './detail/detailHelpers'
import { DetailContent } from './detail/DetailContent'

export function DetailSheet() {
  const open = useOverlays((s) => s.open)
  const overlayItem = useOverlays((s) => s.item)
  const close = useOverlays((s) => s.close)
  const openConfirmDelete = useOverlays((s) => s.openConfirmDelete)
  const openEdit = useOverlays((s) => s.openEdit)
  const openDomain = useOverlays((s) => s.openDomain)
  const { showToast } = useShell()
  const updateCapture = useAtlasStore((s) => s.updateCapture)
  const retryTranscription = useAtlasStore((s) => s.retryTranscription)
  const triageCapture = useAtlasStore((s) => s.triageCapture)
  const clarifyCapture = useAtlasStore((s) => s.clarifyCapture)
  const deleteCapture = useAtlasStore((s) => s.deleteCapture)
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const domains = useAtlasStore((s) => s.domains)

  const item = useMemo(() => {
    if (!overlayItem) return null

    return visibleCaptures({ captures, queuedCaptures })
      .map((capture) => captureToInboxItem(capture, domains))
      .find((candidate) => candidate.id === overlayItem.id || candidate.clientId === overlayItem.clientId)
      ?? overlayItem
  }, [captures, domains, overlayItem, queuedCaptures])

  const visible = open === 'detail' && item != null

  return (
    <BottomSheet visible={visible} onClose={close} height="85%">
      {item ? (
        <DetailContent
          item={item}
          onEdit={() => openEdit(item)}
          onMove={() => openDomain((d) => {
            if (!d) return

            void updateCapture(item.id, { domain: d }).then((updated) => {
              showToast(updated ? `Movido · ${domainLabel(d, domains)}` : 'Falha ao mover captura')
            })
          }, item.id)}
          onDelete={() =>
            openConfirmDelete((confirmed) => {
              if (confirmed) {
                void deleteCapture(item.id).then((deleted) => {
                  if (deleted) {
                    close()
                    showToast('Captura excluída')
                    return
                  }
                  showToast('Falha ao excluir captura')
                })
              }
            })
          }
          onRetryTranscription={async () => {
            const updated = await retryTranscription(item.id)
            showToast(updated ? 'Transcrição reenfileirada' : 'Falha ao reenfileirar transcrição')
          }}
          onTriage={async (input) => {
            const result = await triageCapture(item.id, input)
            const message = triageSuccessMessage(input.action, Boolean(result?.proposal))
            showToast(result ? message : 'Falha ao atualizar triagem')
            return Boolean(result)
          }}
          onClarify={async () => {
            const updated = await clarifyCapture(item.id)
            showToast(updated ? 'Aclaramento atualizado' : 'Falha ao aclarar captura')
            return Boolean(updated)
          }}
        />
      ) : null}
    </BottomSheet>
  )
}
