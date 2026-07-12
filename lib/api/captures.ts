// Captures domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './captures'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core.
//
// Capture triage (CaptureTriageInput/Response, triageCapture) and capture-originated
// project-plan helpers stay in ./client because they reference project/semantic types that
// remain there.
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, getApiBase, queryString } from './core'
import type { DomainKey } from '../domains'

export interface AtlasCaptureLink {
  id: string
  capture_id: string
  target_type: 'semantic_note' | 'semantic_curation_proposal' | 'task' | 'project' | 'hypothesis' | 'external' | string
  target_id: string | null
  target_title: string | null
  relation_type: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type CaptureKind = 'audio' | 'text' | 'photo'
export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'failed' | 'na'
export type CaptureTriageAction =
  | 'promote'
  | 'archive'
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'

export interface AtlasCapture {
  id: string
  client_id: string
  kind: CaptureKind
  domain: DomainKey
  content_text: string | null
  content_file_path: string | null
  content_file_exists: boolean | null
  content_file_integrity: 'available' | 'missing' | 'not_applicable' | string
  content_duration_ms: number | null
  content_size_bytes: number | null
  content_sha256: string | null
  content_mime_type: string | null
  transcription_status: TranscriptionStatus
  transcription_engine: string | null
  transcription_error: string | null
  captured_at: string
  captured_timezone: string
  captured_lat: number | null
  captured_lng: number | null
  pre_capture_digital_context?: Record<string, unknown>
  metadata: Record<string, unknown>
  links?: AtlasCaptureLink[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CapturesResponse {
  captures: AtlasCapture[]
  next_cursor: string | null
  has_more: boolean
}

export interface StoreTextCaptureInput {
  client_id: string
  domain: DomainKey
  content_text: string
  captured_at: string
  captured_timezone: string
  captured_lat?: number | null
  captured_lng?: number | null
  metadata?: Record<string, unknown>
}

export interface UploadCaptureFileInput {
  client_id: string
  kind: Exclude<CaptureKind, 'text'>
  domain: DomainKey
  file_uri: string
  file_name: string
  mime_type: string
  content_duration_ms?: number | null
  captured_at: string
  captured_timezone: string
  captured_lat?: number | null
  captured_lng?: number | null
  metadata?: Record<string, unknown>
}

function appendForm(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return
  form.append(key, String(value))
}

export function getCaptureFileUrl(captureId: string): string {
  return `${getApiBase()}/captures/${encodeURIComponent(captureId)}/file`
}

export async function listCaptures(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  domain?: DomainKey
  kind?: CaptureKind
  client_id?: string
} = {}): Promise<CapturesResponse> {
  return apiGet<CapturesResponse>(`/captures${queryString(params)}`)
}

export async function createTextCapture(input: StoreTextCaptureInput): Promise<AtlasCapture> {
  return apiPost<AtlasCapture>('/captures', {
    ...input,
    kind: 'text',
  })
}

export async function uploadCaptureFile(input: UploadCaptureFileInput): Promise<AtlasCapture> {
  const form = new FormData()

  appendForm(form, 'client_id', input.client_id)
  appendForm(form, 'kind', input.kind)
  appendForm(form, 'domain', input.domain)
  appendForm(form, 'captured_at', input.captured_at)
  appendForm(form, 'captured_timezone', input.captured_timezone)
  appendForm(form, 'captured_lat', input.captured_lat)
  appendForm(form, 'captured_lng', input.captured_lng)
  appendForm(form, 'content_duration_ms', input.content_duration_ms)
  appendForm(form, 'metadata', JSON.stringify(input.metadata ?? {}))

  form.append('file', {
    uri: input.file_uri,
    name: input.file_name,
    type: input.mime_type,
  } as unknown as Blob)

  return apiUpload<AtlasCapture>('/captures', form)
}

export async function patchCapture(
  id: string,
  patch: Partial<Pick<AtlasCapture, 'domain' | 'content_text' | 'content_duration_ms' | 'captured_at' | 'captured_timezone' | 'captured_lat' | 'captured_lng' | 'metadata'>>,
): Promise<AtlasCapture> {
  return apiPatch<AtlasCapture>(`/captures/${id}`, patch)
}

export async function deleteCapture(id: string): Promise<{
  ok: boolean
  deleted_capture_id: string
  deletion: {
    content_purged: boolean
    file_deleted: boolean
  }
}> {
  return apiDelete<{
    ok: boolean
    deleted_capture_id: string
    deletion: {
      content_purged: boolean
      file_deleted: boolean
    }
  }>(`/captures/${id}`)
}

export async function retryCaptureTranscription(id: string): Promise<AtlasCapture> {
  return apiPost<AtlasCapture>(`/captures/${encodeURIComponent(id)}/transcription/retry`, {})
}

export async function clarifyCapture(id: string): Promise<{ capture: AtlasCapture }> {
  return apiPost<{ capture: AtlasCapture }>(`/captures/${encodeURIComponent(id)}/semantic/clarify`, {})
}
