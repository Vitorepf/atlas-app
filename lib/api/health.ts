// Health domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './health'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core.
//
// ponytail: `AtlasHealthSnapshot.state` / `StoreHealthSnapshotInput.state` originally read
// `AtlasCheckin['state']`. AtlasCheckin lives in ./client (checkins domain), so importing it
// here would create a ./health -> ./client cycle. The union is inlined verbatim from
// AtlasCheckin.state ('focused' | 'disperse' | 'blocked' | 'pause'); keep the two in sync if
// that checkin union ever changes.
import { apiGet, apiPost, queryString } from './core'

export interface AtlasHealth {
  status: 'ok' | string
  version: string
  service: string
  ts: string
  db_connected: boolean
  overall_ok?: boolean
  checks?: {
    database?: { ok: boolean }
    storage?: {
      ok: boolean
      writable: boolean
      path: string | null
      error: string | null
    }
    transcription?: {
      enabled: boolean
      engine: string | null
      language: string | null
      binary_path: string | null
      binary_exists: boolean
      binary_executable: boolean
      model_path: string | null
      model_exists: boolean
      ffmpeg_path: string | null
      ffmpeg_exists: boolean
      ffmpeg_executable: boolean
    }
    transcription_jobs?: {
      queued: number
      processing: number
      failed: number
    }
    scheduler?: {
      configured: boolean
      note: string
    }
    queue?: {
      connection: string
      transcription_queue: string
      note: string
    }
  }
}

export interface AtlasHealthSnapshot {
  id: string
  client_id: string
  source: 'atlas_app' | 'server' | 'import'
  snapshot_date: string
  snapshot_timezone: string
  computed_at: string
  signal_count: number
  readiness_score: number | null
  current_score: number | null
  body_score: number | null
  mind_score: number | null
  drive_score: number | null
  sleep_score: number | null
  autonomic_score: number | null
  load_score: number | null
  subjective_score: number | null
  stability_score: number | null
  confidence: number | null
  sleep_duration_hours: number | null
  sleep_efficiency: number | null
  hrv_ms: number | null
  resting_heart_rate_bpm: number | null
  respiratory_rate: number | null
  wrist_temperature_c: number | null
  active_energy_kcal: number | null
  basal_energy_kcal: number | null
  exercise_minutes: number | null
  stand_minutes: number | null
  steps: number | null
  walking_running_distance_m: number | null
  vo2max: number | null
  body_mass_kg: number | null
  body_fat_percentage: number | null
  lean_body_mass_kg: number | null
  muscle_mass_percentage: number | null
  body_mass_index: number | null
  waist_circumference_cm: number | null
  energy_level: number | null
  mood_level: number | null
  state: 'focused' | 'disperse' | 'blocked' | 'pause' | null
  metrics: Record<string, unknown>
  readiness: Record<string, unknown>
  sleep: Record<string, unknown>
  recovery: Record<string, unknown>
  load: Record<string, unknown>
  subjective: Record<string, unknown>
  body: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface HealthSnapshotsResponse {
  health_snapshots: AtlasHealthSnapshot[]
  next_cursor: string | null
  has_more: boolean
}

export interface StoreHealthSnapshotInput {
  client_id: string
  source: AtlasHealthSnapshot['source']
  snapshot_date: string
  snapshot_timezone: string
  computed_at: string
  signal_count: number
  readiness_score?: number | null
  current_score?: number | null
  body_score?: number | null
  mind_score?: number | null
  drive_score?: number | null
  sleep_score?: number | null
  autonomic_score?: number | null
  load_score?: number | null
  subjective_score?: number | null
  stability_score?: number | null
  confidence?: number | null
  sleep_duration_hours?: number | null
  sleep_efficiency?: number | null
  hrv_ms?: number | null
  resting_heart_rate_bpm?: number | null
  respiratory_rate?: number | null
  wrist_temperature_c?: number | null
  active_energy_kcal?: number | null
  basal_energy_kcal?: number | null
  exercise_minutes?: number | null
  stand_minutes?: number | null
  steps?: number | null
  walking_running_distance_m?: number | null
  vo2max?: number | null
  body_mass_kg?: number | null
  body_fat_percentage?: number | null
  lean_body_mass_kg?: number | null
  muscle_mass_percentage?: number | null
  body_mass_index?: number | null
  waist_circumference_cm?: number | null
  energy_level?: number | null
  mood_level?: number | null
  state?: 'focused' | 'disperse' | 'blocked' | 'pause' | null
  metrics?: Record<string, unknown>
  readiness?: Record<string, unknown>
  sleep?: Record<string, unknown>
  recovery?: Record<string, unknown>
  load?: Record<string, unknown>
  subjective?: Record<string, unknown>
  body?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export async function getHealth(): Promise<AtlasHealth> {
  return apiGet<AtlasHealth>('/health', { auth: false })
}

export async function listHealthSnapshots(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  source?: AtlasHealthSnapshot['source']
  date_from?: string
  date_to?: string
} = {}): Promise<HealthSnapshotsResponse> {
  return apiGet<HealthSnapshotsResponse>(`/health-snapshots${queryString(params)}`)
}

export async function createHealthSnapshot(input: StoreHealthSnapshotInput): Promise<AtlasHealthSnapshot> {
  return apiPost<AtlasHealthSnapshot>('/health-snapshots', input)
}
