// Atlas Loop · component barrel. The Loop is the FLAGSHIP surface and the only
// way the operator talks to the autonomous 24h loop. Every component resolves
// colors via usePalette, uses STATIC dots, and is honest by construction
// (real-or-blocked; proof only when real; blockers verbatim; proposal-only).

export { StatusDot } from './StatusDot'
export { LoopStatusPill } from './LoopStatusPill'
export { Metric } from './Metric'
export { Segmented } from './Segmented'
export { RiskSelector } from './RiskSelector'
export { RiskTag } from './RiskTag'
export { ProofChip } from './ProofChip'
export { MergeHashChip } from './MergeHashChip'
export { RationaleField } from './RationaleField'
export { SealedDecisionRow } from './SealedDecisionRow'
export { VitalLedger } from './VitalLedger'
export { ImmuneLedger } from './ImmuneLedger'
export { CycleEntry } from './CycleEntry'
export { CycleReceiptSheet } from './CycleReceiptSheet'
export { DecisionCard } from './DecisionCard'
export { DirectiveComposer } from './DirectiveComposer'
export { DirectiveHonestyBand } from './DirectiveHonestyBand'
export { DirectiveRow } from './DirectiveRow'
export { RunControlBar } from './RunControlBar'
export { RunControlConfirmStrip } from './RunControlConfirmStrip'
export { TrustColophon } from './TrustColophon'
export { BlockedNote } from './BlockedNote'
export { Colophon } from './Colophon'

export {
  deriveLoopState,
  loopStateWord,
  loopTone,
  normalizeHealth,
  riskTone,
  riskWord,
  statusColor,
  statusLabel,
  type LoopState,
} from './loopTone'
export {
  absoluteTime,
  relativeTime,
  shortHash,
  shortMergeHash,
  uptimeSince,
} from './loopFormat'
export {
  decisionErrorMessage,
  directiveErrorMessage,
  mapReviewQueue,
  type DecisionProposal,
  type OperatorDecisionVerdict,
} from './loopTypes'
