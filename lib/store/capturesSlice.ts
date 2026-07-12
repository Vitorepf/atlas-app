import {
  AtlasApiError,
  clarifyCapture as clarifyServerCapture,
  deleteCapture as deleteServerCapture,
  patchCapture,
  retryCaptureTranscription,
  triageCapture as triageServerCapture,
} from '../api/client'
import { LOCAL_ID_PREFIX, mergeCaptures, queuedToCapture, type QueuedCapture } from '../storeConverters'
import {
  LOCAL_AUDIO_DIR,
  LOCAL_PHOTO_DIR,
  deviceTimezone,
  fileNameFor,
  humanError,
  newClientId,
  persistCaptureFile,
} from './internals'
import { persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type CapturesSlice = Pick<
  AtlasState,
  | 'captures'
  | 'queuedCaptures'
  | 'createAudioCapture'
  | 'createPhotoCapture'
  | 'createTextCapture'
  | 'updateCapture'
  | 'retryTranscription'
  | 'triageCapture'
  | 'clarifyCapture'
  | 'deleteCapture'
>

export const createCapturesSlice = (set: AtlasSet, get: AtlasGet): CapturesSlice => ({
  captures: [],
  queuedCaptures: [],

  createAudioCapture: async (input) => {
    const clientId = newClientId()
    const capturedAt = input.capturedAt ?? new Date().toISOString()
    const fileUri = await persistCaptureFile(input.fileUri, LOCAL_AUDIO_DIR, `${clientId}.m4a`)
    const queued: QueuedCapture = {
      client_id: clientId,
      kind: 'audio',
      domain: input.domain,
      file_uri: fileUri,
      file_name: fileNameFor(fileUri, clientId, 'm4a'),
      mime_type: 'audio/m4a',
      content_duration_ms: input.durationMs ?? null,
      captured_at: capturedAt,
      captured_timezone: input.capturedTimezone ?? deviceTimezone(),
      captured_lat: input.capturedLat ?? null,
      captured_lng: input.capturedLng ?? null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedCaptures: [queued, ...state.queuedCaptures] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createPhotoCapture: async (input) => {
    const clientId = newClientId()
    const fileUri = await persistCaptureFile(input.fileUri, LOCAL_PHOTO_DIR, `${clientId}.jpg`)
    const queued: QueuedCapture = {
      client_id: clientId,
      kind: 'photo',
      domain: input.domain,
      file_uri: fileUri,
      file_name: fileNameFor(fileUri, clientId, 'jpg'),
      mime_type: input.mimeType ?? 'image/jpeg',
      captured_at: input.capturedAt ?? new Date().toISOString(),
      captured_timezone: input.capturedTimezone ?? deviceTimezone(),
      captured_lat: input.capturedLat ?? null,
      captured_lng: input.capturedLng ?? null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedCaptures: [queued, ...state.queuedCaptures] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createTextCapture: async (input) => {
    const clientId = newClientId()
    const queued: QueuedCapture = {
      client_id: clientId,
      kind: 'text',
      domain: input.domain,
      content_text: input.text,
      captured_at: input.capturedAt ?? new Date().toISOString(),
      captured_timezone: input.capturedTimezone ?? deviceTimezone(),
      captured_lat: input.capturedLat ?? null,
      captured_lng: input.capturedLng ?? null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedCaptures: [queued, ...state.queuedCaptures] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  updateCapture: async (id, patch) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      const clientId = id.slice(LOCAL_ID_PREFIX.length)
      let updated: QueuedCapture | null = null

      set((state) => ({
        queuedCaptures: state.queuedCaptures.map((capture) => {
          if (capture.client_id !== clientId) return capture
          updated = {
            ...capture,
            domain: patch.domain ?? capture.domain,
            content_text: patch.content_text === undefined ? capture.content_text : patch.content_text,
            metadata: patch.metadata ?? capture.metadata,
          }
          return updated
        }),
      }))

      await persist(get())
      return updated ? queuedToCapture(updated) : null
    }

    const previous = get().captures
    set((state) => ({
      captures: state.captures.map((capture) => (
        capture.id === id ? { ...capture, ...patch, updated_at: new Date().toISOString() } : capture
      )),
    }))

    try {
      const updated = await patchCapture(id, patch)
      set((state) => ({ captures: mergeCaptures([...state.captures, updated]) }))
      await persist(get())
      return updated
    } catch (error) {
      set({ captures: previous, lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  retryTranscription: async (id) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      set({ lastError: 'A captura local precisa sincronizar antes do retry.' })
      return null
    }

    const previous = get().captures
    set((state) => ({
      captures: state.captures.map((capture) => (
        capture.id === id
          ? {
              ...capture,
              transcription_status: 'pending',
              transcription_error: null,
              updated_at: new Date().toISOString(),
            }
          : capture
      )),
    }))

    try {
      const updated = await retryCaptureTranscription(id)
      set((state) => ({ captures: mergeCaptures([...state.captures, updated]), serverReachable: true, lastError: null }))
      await persist(get())
      return updated
    } catch (error) {
      set({ captures: previous, lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  triageCapture: async (id, input) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      set({ lastError: 'A captura local precisa sincronizar antes da triagem.' })
      return null
    }

    try {
      const result = await triageServerCapture(id, input)
      set((state) => ({
        captures: mergeCaptures([...state.captures, result.capture]),
        serverReachable: true,
        lastError: null,
      }))
      await persist(get())
      return result
    } catch (error) {
      set({ lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  clarifyCapture: async (id) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      set({ lastError: 'A captura local precisa sincronizar antes do aclaramento.' })
      return null
    }

    try {
      const result = await clarifyServerCapture(id)
      set((state) => ({
        captures: mergeCaptures([...state.captures, result.capture]),
        serverReachable: true,
        lastError: null,
      }))
      await persist(get())
      return result.capture
    } catch (error) {
      set({ lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  deleteCapture: async (id) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      const clientId = id.slice(LOCAL_ID_PREFIX.length)
      set((state) => ({ queuedCaptures: state.queuedCaptures.filter((capture) => capture.client_id !== clientId) }))
      await persist(get())
      return true
    }

    const previous = get().captures
    set((state) => ({ captures: state.captures.filter((capture) => capture.id !== id) }))

    try {
      await deleteServerCapture(id)
      await persist(get())
      return true
    } catch (error) {
      set({ captures: previous, lastError: humanError(error), serverReachable: false })
      await persist(get())
      return false
    }
  },
})
