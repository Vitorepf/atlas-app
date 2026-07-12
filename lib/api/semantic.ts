// Semantic + cognitive-game domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './semantic'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core.
//
// ponytail: VaultHealth (AtlasVaultHealthSnapshot + getVaultHealth/recomputeVaultHealth) and its
// AtlasCognitiveReturn sub-type live in ./memory, not here — see that module.
import { apiGet, apiPost, queryString } from './core'

export type SemanticNoteType =
  | 'source_note'
  | 'mental_model'
  | 'principle'
  | 'hypothesis'
  | 'practice'
  | 'synthesis'
  | 'decision_identity'
  | 'cognitive_game'

export type SemanticNoteStatus = 'inbox' | 'draft' | 'active' | 'testing' | 'validated' | 'archived' | 'invalid'

export interface AtlasSemanticNote {
  id: string
  note_key: string
  path: string
  title: string
  type: SemanticNoteType
  status: SemanticNoteStatus
  confidence: 'low' | 'medium' | 'high' | 'validated'
  maturity: 'seed' | 'draft' | 'useful' | 'tested' | 'principle' | 'archived'
  domains: unknown[]
  summary: string | null
  body_excerpt: string | null
  frontmatter: Record<string, unknown>
  when_to_use: unknown[]
  trigger_signals: unknown[]
  do_not_use_when: unknown[]
  postgres_refs: Record<string, unknown>
  content_hash: string
  indexed_at: string | null
  last_seen_at: string | null
  last_activated_at: string | null
  last_practiced_at: string | null
  activation_count: number
  usefulness_avg: number | null
  validation_errors: unknown[]
  metadata: Record<string, unknown>
  source_links_count?: number
  target_links_count?: number
  source_links?: AtlasSemanticNoteLink[]
  target_links?: AtlasSemanticNoteLink[]
  score?: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasSemanticNoteLink {
  id: string
  source_note_id: string
  target_note_id: string
  source_note?: AtlasSemanticNote
  target_note?: AtlasSemanticNote
  link_type: 'supports' | 'contradicts' | 'extends' | 'example_of' | 'applies_to' | 'derived_from' | 'similar_to' | 'tension'
  explanation: string
  created_by: 'operator' | 'atlas_suggestion' | 'import'
  confidence: number | null
  confirmed_by_operator: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasSemanticCurationProposal {
  id: string
  source_type: 'capture' | 'transcription' | 'behavior_pattern' | 'health_pattern' | 'rize_pattern' | 'manual'
  source_refs: Record<string, unknown>
  proposed_note_type: SemanticNoteType
  proposed_title: string
  proposed_summary: string
  proposed_path: string | null
  proposed_frontmatter: Record<string, unknown>
  proposed_body: string | null
  score: number | null
  reason: string
  status: 'pending' | 'accepted' | 'edited' | 'dismissed' | 'postponed'
  shown_at: string | null
  resolved_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasSemanticActivation {
  id: string
  note_id: string
  note?: AtlasSemanticNote
  activation_type: 'remember' | 'practice' | 'connect' | 'confront' | 'test' | 'promote' | 'archive_review'
  context_type: string
  context_payload: Record<string, unknown>
  prompt: string
  shown_at: string | null
  acted_at: string | null
  dismissed_at: string | null
  usefulness_score: number | null
  feedback_action: 'useful' | 'not_useful' | 'too_early' | 'too_late' | 'dismissed' | null
  operator_feedback: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasCognitiveGameRun {
  id: string
  game_key: string
  title: string
  input_note_ids: unknown[]
  prompt: string
  operator_answer: string | null
  atlas_feedback: string | null
  score: number | null
  duration_seconds: number | null
  promoted_note_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SemanticNotesResponse {
  notes: AtlasSemanticNote[]
}

export interface SemanticNoteDetailResponse {
  note: AtlasSemanticNote
  content: string | null
}

export interface SemanticCurationProposalsResponse {
  proposals: AtlasSemanticCurationProposal[]
}

export interface SemanticActivationsResponse {
  activations: AtlasSemanticActivation[]
}

export interface CognitiveGameTodayResponse {
  game: AtlasCognitiveGameRun | null
}

export async function listSemanticNotes(params: {
  limit?: number
  domain?: string
  trigger_signal?: string
  since?: string
} = {}): Promise<SemanticNotesResponse> {
  return apiGet<SemanticNotesResponse>(`/semantic/notes${queryString(params)}`)
}

export async function getSemanticNote(id: string): Promise<SemanticNoteDetailResponse> {
  return apiGet<SemanticNoteDetailResponse>(`/semantic/notes/${encodeURIComponent(id)}`)
}

export async function reindexSemanticVault(): Promise<{
  vault_created: string[]
  index: { created: number; updated: number; skipped: number; deleted: number }
}> {
  return apiPost('/semantic/notes/reindex', {})
}

export async function searchSemanticNotes(input: {
  query?: string
  limit?: number
  filters?: Record<string, unknown>
}): Promise<SemanticNotesResponse> {
  return apiPost<SemanticNotesResponse>('/semantic/search', input)
}

export async function listSemanticCurationProposals(params: {
  status?: AtlasSemanticCurationProposal['status']
  limit?: number
} = {}): Promise<SemanticCurationProposalsResponse> {
  return apiGet<SemanticCurationProposalsResponse>(`/semantic/curation-proposals${queryString(params)}`)
}

export async function acceptSemanticCurationProposal(
  id: string,
  edits: { path?: string; frontmatter_edits?: Record<string, unknown>; body_edits?: string } = {},
): Promise<{ proposal: AtlasSemanticCurationProposal; note: AtlasSemanticNote }> {
  return apiPost(`/semantic/curation-proposals/${encodeURIComponent(id)}/accept`, edits)
}

export async function dismissSemanticCurationProposal(id: string): Promise<AtlasSemanticCurationProposal> {
  return apiPost(`/semantic/curation-proposals/${encodeURIComponent(id)}/dismiss`, {})
}

export async function postponeSemanticCurationProposal(id: string): Promise<AtlasSemanticCurationProposal> {
  return apiPost(`/semantic/curation-proposals/${encodeURIComponent(id)}/postpone`, {})
}

export async function listSemanticActivations(params: {
  context_type?: string
  limit?: number
} = {}): Promise<SemanticActivationsResponse> {
  return apiGet<SemanticActivationsResponse>(`/semantic/activations${queryString(params)}`)
}

export async function createSemanticActivations(input: {
  context_type?: string
  context_payload?: Record<string, unknown>
} = {}): Promise<{ created: number; skipped: number; signals: string[] }> {
  return apiPost('/semantic/activations', input)
}

export async function markSemanticActivationShown(id: string): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/shown`, {})
}

export async function feedbackSemanticActivation(
  id: string,
  usefulness_score: number,
  feedback_action?: AtlasSemanticActivation['feedback_action'],
  operator_feedback?: string,
): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/feedback`, {
    usefulness_score,
    feedback_action,
    operator_feedback,
  })
}

export async function dismissSemanticActivation(id: string): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/dismiss`, {})
}

export async function getTodayCognitiveGame(): Promise<CognitiveGameTodayResponse> {
  return apiGet<CognitiveGameTodayResponse>('/semantic/cognitive-games/today')
}

export async function startCognitiveGame(input: {
  game_key?: 'recall' | 'forced_connection' | 'adversarial' | 'blind_application' | 'synthesis'
  note_ids?: string[]
} = {}): Promise<AtlasCognitiveGameRun> {
  return apiPost<AtlasCognitiveGameRun>('/semantic/cognitive-games', input)
}

export async function answerCognitiveGame(
  id: string,
  operator_answer: string,
  duration_seconds?: number,
): Promise<AtlasCognitiveGameRun> {
  return apiPost<AtlasCognitiveGameRun>(`/semantic/cognitive-games/${encodeURIComponent(id)}/answer`, {
    operator_answer,
    duration_seconds,
  })
}
