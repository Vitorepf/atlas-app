import { DetailSheet } from './DetailSheet'
import { DomainSheet } from './DomainSheet'
import { ConfirmDelete } from './ConfirmDelete'
import { EditSheet } from './EditSheet'
import { SettingsSheet } from './SettingsSheet'
import { MicModal } from './MicModal'
import { AtlasAiSheet } from './AtlasAiSheet'
import { SnoozeSheet } from './SnoozeSheet'
import { TriageOverflowSheet } from './TriageOverflowSheet'
import { OperationalDetailSheet } from './OperationalDetailSheet'
import { InboxDomainSheet } from '../inbox/InboxDomainSheet'
import { CaptureSettingsSheet } from '../capture/CaptureSettingsSheet'
import { ProviderChoiceModal } from './ProviderChoiceModal'

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
      <SnoozeSheet />
      <TriageOverflowSheet />
      <OperationalDetailSheet />
      <InboxDomainSheet />
      <CaptureSettingsSheet />
      <ProviderChoiceModal />
    </>
  )
}
