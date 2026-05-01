import { create } from 'zustand'
import type { InboxItem } from '../components/InboxCard'
import type { InboxDomainFilter } from '../components/inbox/InboxDomainStatus'
import type { DomainKey } from './domains'

export type CaptureMode = 'audio' | 'text' | 'photo'
export type CaptureSensitivity = 'normal' | 'private' | 'sensitive'
export interface CaptureSettings {
  mode: CaptureMode
  domain: DomainKey
  sensitivity: CaptureSensitivity
}

// Overlay registry — every sheet/modal in the app routes through here so
// only one shell context manages animation, scrim, and dismissal.

export type OverlayKey =
  | 'detail'
  | 'domain'
  | 'confirmDelete'
  | 'edit'
  | 'settings'
  | 'mic'
  | 'atlasAi'
  | 'inboxDomainFilter'
  | 'captureSettings'
  | 'providerChoice'

interface OverlayState {
  open: OverlayKey | null
  // Detail / edit context
  item: InboxItem | null
  // Domain picker callback (resolves with chosen domain or null on skip)
  onPickDomain: ((d: DomainKey | null) => void) | null
  // Confirm-delete callback (resolves true on confirm, false on cancel)
  onConfirmDelete: ((confirmed: boolean) => void) | null
  // Inbox domain filter — current value and select callback
  inboxDomainFilter: InboxDomainFilter
  onPickInboxDomainFilter: ((d: InboxDomainFilter) => void) | null
  // Capture settings — current values and update callback
  captureSettings: CaptureSettings | null
  onUpdateCaptureSettings: ((next: Partial<CaptureSettings>) => void) | null

  openDetail: (item: InboxItem) => void
  openDomain: (cb: (d: DomainKey | null) => void) => void
  openConfirmDelete: (cb: (confirmed: boolean) => void) => void
  openEdit: (item: InboxItem) => void
  openSettings: () => void
  openMic: () => void
  openAtlasAi: () => void
  openInboxDomainFilter: (
    current: InboxDomainFilter,
    cb: (d: InboxDomainFilter) => void,
  ) => void
  openCaptureSettings: (
    current: CaptureSettings,
    onUpdate: (next: Partial<CaptureSettings>) => void,
  ) => void
  close: () => void

  // Provider choice — job paused awaiting operator decision
  providerChoiceJobId: string | null
  providerChoiceErrorCode: string | null
  providerChoiceResetHint: string | null
  providerChoiceOptions: import('./api/client').AtlasAiChoiceOption[]
  openProviderChoice: (input: {
    jobId: string
    errorCode: string | null
    resetHint: string | null
    options: import('./api/client').AtlasAiChoiceOption[]
  }) => void
  closeProviderChoice: () => void
}

export const useOverlays = create<OverlayState>((set) => ({
  open: null,
  item: null,
  onPickDomain: null,
  onConfirmDelete: null,
  inboxDomainFilter: 'all',
  onPickInboxDomainFilter: null,
  captureSettings: null,
  onUpdateCaptureSettings: null,
  providerChoiceJobId: null,
  providerChoiceErrorCode: null,
  providerChoiceResetHint: null,
  providerChoiceOptions: [],

  openDetail: (item) => set({ open: 'detail', item }),
  openDomain: (cb) => set({ open: 'domain', onPickDomain: cb }),
  openConfirmDelete: (cb) => set({ open: 'confirmDelete', onConfirmDelete: cb }),
  openEdit: (item) => set({ open: 'edit', item }),
  openSettings: () => set({ open: 'settings' }),
  openMic: () => set({ open: 'mic' }),
  openAtlasAi: () => set({ open: 'atlasAi' }),
  openInboxDomainFilter: (current, cb) =>
    set({
      open: 'inboxDomainFilter',
      inboxDomainFilter: current,
      onPickInboxDomainFilter: cb,
    }),
  openCaptureSettings: (current, onUpdate) =>
    set({
      open: 'captureSettings',
      captureSettings: current,
      onUpdateCaptureSettings: onUpdate,
    }),
  close: () =>
    set({
      open: null,
      onPickDomain: null,
      onConfirmDelete: null,
      onPickInboxDomainFilter: null,
      onUpdateCaptureSettings: null,
    }),
  openProviderChoice: (input) =>
    set({
      open: 'providerChoice',
      providerChoiceJobId: input.jobId,
      providerChoiceErrorCode: input.errorCode,
      providerChoiceResetHint: input.resetHint,
      providerChoiceOptions: input.options,
    }),
  closeProviderChoice: () =>
    set({
      open: null,
      providerChoiceJobId: null,
      providerChoiceErrorCode: null,
      providerChoiceResetHint: null,
      providerChoiceOptions: [],
    }),
}))
