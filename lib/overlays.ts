import { create } from 'zustand'
import type { InboxItem } from '../components/InboxCard'
import type { DomainKey } from './domains'

// Overlay registry — every sheet/modal in the app routes through here so
// only one shell context manages animation, scrim, and dismissal.

export type OverlayKey =
  | 'detail'
  | 'domain'
  | 'confirmDelete'
  | 'edit'
  | 'settings'
  | 'mic'

interface OverlayState {
  open: OverlayKey | null
  // Detail / edit context
  item: InboxItem | null
  // Domain picker callback (resolves with chosen domain or null on skip)
  onPickDomain: ((d: DomainKey | null) => void) | null
  // Confirm-delete callback (resolves true on confirm, false on cancel)
  onConfirmDelete: ((confirmed: boolean) => void) | null

  openDetail: (item: InboxItem) => void
  openDomain: (cb: (d: DomainKey | null) => void) => void
  openConfirmDelete: (cb: (confirmed: boolean) => void) => void
  openEdit: (item: InboxItem) => void
  openSettings: () => void
  openMic: () => void
  close: () => void
}

export const useOverlays = create<OverlayState>((set) => ({
  open: null,
  item: null,
  onPickDomain: null,
  onConfirmDelete: null,

  openDetail: (item) => set({ open: 'detail', item }),
  openDomain: (cb) => set({ open: 'domain', onPickDomain: cb }),
  openConfirmDelete: (cb) => set({ open: 'confirmDelete', onConfirmDelete: cb }),
  openEdit: (item) => set({ open: 'edit', item }),
  openSettings: () => set({ open: 'settings' }),
  openMic: () => set({ open: 'mic' }),
  close: () => set({ open: null, onPickDomain: null, onConfirmDelete: null }),
}))
