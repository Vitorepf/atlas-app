import { recordAtlasAiEvent } from './atlasAiTelemetry'

export type AtlasPerformanceEventName =
  | 'edition_visible_ms'
  | 'atlas_ai_ready_ms'
  | 'settings_open_ms'
  | 'history_open_ms'

export function nowMs(): number {
  return Date.now()
}

export function recordPerformanceDuration(
  eventName: AtlasPerformanceEventName,
  startedAtMs: number,
  metadata?: Record<string, unknown>,
): void {
  const durationMs = Math.max(0, Math.round(Date.now() - startedAtMs))
  void recordAtlasAiEvent({
    eventName,
    metadata: {
      ...metadata,
      duration_ms: durationMs,
    },
  })
}
