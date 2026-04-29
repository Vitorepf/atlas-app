import { DetailSheet } from './DetailSheet'
import { DomainSheet } from './DomainSheet'
import { ConfirmDelete } from './ConfirmDelete'
import { EditSheet } from './EditSheet'
import { SettingsSheet } from './SettingsSheet'
import { MicModal } from './MicModal'

// Mounts every overlay once. Each component subscribes to the overlay store
// and animates itself in/out — never unmounted, so transitions stay smooth.
export function OverlayHost() {
  return (
    <>
      <DetailSheet />
      <DomainSheet />
      <ConfirmDelete />
      <EditSheet />
      <SettingsSheet />
      <MicModal />
    </>
  )
}
