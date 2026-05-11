import { create } from 'zustand'
import type { InboxItem } from '../components/InboxCard'
import type { InboxDomainFilter } from '../components/inbox/InboxDomainStatus'
import type { DomainKey } from './domains'
import type { SnoozeOption } from './snoozeOptions'
import type { OverflowAction } from '../components/sheets/TriageOverflowSheet'

export type CaptureMode = 'audio' | 'text' | 'photo'
export type CaptureSensitivity = 'normal' | 'private' | 'sensitive'
// v18 canon · destino editorial após captura · section ii do mockup
// "Categorizar + Elaborar". Conversar abre Atlas AI, Tarefa/Projeto estruturam
// via Atlas Decide, Salvar vai pro inbox raw.
export type DomainDestino = 'conversar' | 'tarefa' | 'projeto' | 'salvar'
export interface CaptureSettings {
  mode: CaptureMode
  domain: DomainKey
  sensitivity: CaptureSensitivity
}

export interface ConfirmDeleteCopy {
  title?: string
  body?: string
  confirmLabel?: string
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
  | 'snooze'
  | 'triageOverflow'
  | 'operationalDetail'

interface OverlayState {
  open: OverlayKey | null
  // Detail / edit context
  item: InboxItem | null
  // Domain picker callback · v18 canon expandido · 2º arg opcional `destino`
  // (Conversar/Tarefa/Projeto/Salvar) pra suporte ao mockup canônico
  // "Categorizar + Elaborar" com sections i. Sobre o quê é? + ii. O que fazer?
  // Callbacks antigos que só usam `d` continuam funcionando (2º arg ignorado).
  onPickDomain: ((d: DomainKey | null, destino?: DomainDestino) => void) | null
  // Confirm-delete callback (resolves true on confirm, false on cancel)
  onConfirmDelete: ((confirmed: boolean) => void) | null
  confirmDeleteCopy: ConfirmDeleteCopy | null
  // Inbox domain filter — current value and select callback
  inboxDomainFilter: InboxDomainFilter
  onPickInboxDomainFilter: ((d: InboxDomainFilter) => void) | null
  // Capture settings — current values and update callback
  captureSettings: CaptureSettings | null
  onUpdateCaptureSettings: ((next: Partial<CaptureSettings>) => void) | null
  atlasAiThreadId: string | null
  atlasAiOpenNonce: number
  onSnooze: ((option: SnoozeOption | null) => void) | null
  onTriageOverflow: ((action: OverflowAction | null) => void) | null
  /** Captura ID opcional · quando passado pra openDomain, DomainSheet
   *  consulta `getAtlasDecide(captureId)` pra pre-populate domínio + destino
   *  com base no LLM classifier. */
  domainSheetCaptureId: string | null
  /** Pré-classificação heurística (client-side · `inferAtlasDecide`) ·
   *  usada quando ainda não há captureId (fluxo de criação). DomainSheet
   *  usa esses valores como pickedDomain inicial + destino sugerido. */
  domainSheetPrePicked: { domain: DomainKey; destino: DomainDestino } | null
  /** ID do item operacional aberto via `openOperationalDetail`. */
  operationalDetailId: string | null

  openDetail: (item: InboxItem) => void
  openOperationalDetail: (itemId: string) => void
  openDomain: (
    cb: (d: DomainKey | null, destino?: DomainDestino) => void,
    captureId?: string,
    prePicked?: { domain: DomainKey; destino: DomainDestino } | null,
  ) => void
  openConfirmDelete: (cb: (confirmed: boolean) => void, copy?: ConfirmDeleteCopy) => void
  openEdit: (item: InboxItem) => void
  openSettings: () => void
  openMic: () => void
  openAtlasAi: (threadId?: string | null) => void
  openSnooze: (cb: (option: SnoozeOption | null) => void) => void
  openTriageOverflow: (cb: (action: OverflowAction | null) => void) => void
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
  confirmDeleteCopy: null,
  inboxDomainFilter: 'all',
  onPickInboxDomainFilter: null,
  captureSettings: null,
  onUpdateCaptureSettings: null,
  providerChoiceJobId: null,
  providerChoiceErrorCode: null,
  providerChoiceResetHint: null,
  providerChoiceOptions: [],
  atlasAiThreadId: null,
  atlasAiOpenNonce: 0,
  onSnooze: null,
  onTriageOverflow: null,
  domainSheetCaptureId: null,
  domainSheetPrePicked: null,
  operationalDetailId: null,

  openDetail: (item) => set({ open: 'detail', item }),
  openOperationalDetail: (itemId) =>
    set({ open: 'operationalDetail', operationalDetailId: itemId }),
  openDomain: (cb, captureId, prePicked) =>
    set({
      open: 'domain',
      onPickDomain: cb,
      domainSheetCaptureId: captureId ?? null,
      domainSheetPrePicked: prePicked ?? null,
    }),
  openConfirmDelete: (cb, copy) => set({ open: 'confirmDelete', onConfirmDelete: cb, confirmDeleteCopy: copy ?? null }),
  openEdit: (item) => set({ open: 'edit', item }),
  openSettings: () => set({ open: 'settings' }),
  openMic: () => set({ open: 'mic' }),
  openAtlasAi: (threadId = null) => set((s) => ({ open: 'atlasAi', atlasAiThreadId: threadId ?? null, atlasAiOpenNonce: s.atlasAiOpenNonce + 1 })),
  openSnooze: (cb) => set({ open: 'snooze', onSnooze: cb }),
  openTriageOverflow: (cb) => set({ open: 'triageOverflow', onTriageOverflow: cb }),
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
      atlasAiThreadId: null,
      onPickDomain: null,
      onConfirmDelete: null,
      onSnooze: null,
      onTriageOverflow: null,
      domainSheetCaptureId: null,
      domainSheetPrePicked: null,
      operationalDetailId: null,
      confirmDeleteCopy: null,
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
