import { DetailSheet } from './DetailSheet'
import { DomainSheet } from './DomainSheet'
import { ConfirmDelete } from './ConfirmDelete'
import { EditSheet } from './EditSheet'
import { SettingsSheet } from './SettingsSheet'
import { MicModal } from './MicModal'
import { AtlasAiSheet } from './AtlasAiSheet'
import { InboxDomainSheet } from '../inbox/InboxDomainSheet'
import { CaptureSettingsSheet } from '../capture/CaptureSettingsSheet'

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
      <AtlasAiSheet />
      <InboxDomainSheet />
      <CaptureSettingsSheet />
    </>
  )
}
