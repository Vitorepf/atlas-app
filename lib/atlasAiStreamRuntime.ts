export interface AtlasAiStreamEvent {
  id?: string
  trace_id: string
  job_id?: string | null
  attempt_id?: string | null
  sequence: number
  type: string
  channel?: string | null
  content?: string | null
  metadata?: Record<string, unknown>
  occurred_at?: string | null
}

export interface AtlasAiStreamDone {
  trace_id: string
  status: string
  last_sequence?: number
}

export type AtlasAiStreamHandlers = {
  onEvent?: (event: AtlasAiStreamEvent) => void
  onDone?: (event: AtlasAiStreamDone) => void
  onError?: (error: unknown) => void
}

export type AtlasAiStreamOptions = {
  after?: number
  timeoutSeconds?: number
  maxReconnects?: number
}

export type AtlasAiStreamRuntimeConfig = {
  traceId: string
  handlers: AtlasAiStreamHandlers
  options?: AtlasAiStreamOptions
  prepare?: () => Promise<void>
  getApiBase: () => string
  getAuthHeaders: () => Record<string, string>
  createHttpError?: (status: number, url: string) => Error
  fetchImpl?: typeof fetch
}

export function createAtlasAiInteractionStream(config: AtlasAiStreamRuntimeConfig): { cancel: () => void } {
  const controller = new AbortController()
  const fetchImpl = config.fetchImpl ?? fetch
  const options = config.options ?? {}

  void (async () => {
    let completed = false
    let lastSequence = Math.max(0, options.after ?? 0)
    const timeoutSeconds = Math.min(Math.max(options.timeoutSeconds ?? 120, 5), 600)
    const maxReconnects = Math.max(0, options.maxReconnects ?? 4)

    try {
      await config.prepare?.()

      for (let attempt = 0; attempt <= maxReconnects && !controller.signal.aborted && !completed; attempt += 1) {
        const params = new URLSearchParams({
          timeout: String(timeoutSeconds),
          after: String(lastSequence),
        })
        const url = `${config.getApiBase()}/ai/interactions/${encodeURIComponent(config.traceId)}/stream?${params.toString()}`
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            ...config.getAuthHeaders(),
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw config.createHttpError?.(response.status, response.url) ?? new Error(`Atlas stream ${response.status}`)
        }

        const streamHandlers = {
          ...config.handlers,
          onEvent: (event: AtlasAiStreamEvent) => {
            if (controller.signal.aborted) return
            if (event.trace_id !== config.traceId) return
            lastSequence = Math.max(lastSequence, event.sequence)
            config.handlers.onEvent?.(event)
          },
          onDone: (event: AtlasAiStreamDone) => {
            if (controller.signal.aborted) return
            if (event.trace_id !== config.traceId) return
            if (typeof event.last_sequence === 'number') {
              lastSequence = Math.max(lastSequence, event.last_sequence)
            }
            completed = true
            config.handlers.onDone?.(event)
          },
        }

        const body = response.body
        if (!body || typeof (body as unknown as { getReader?: unknown }).getReader !== 'function') {
          const text = await response.text()
          if (controller.signal.aborted) break
          for (const frame of parseAtlasAiSseFrames(text)) dispatchAtlasAiStreamFrame(frame, streamHandlers)
        } else {
          const reader = (body as ReadableStream<Uint8Array>).getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { value, done } = await reader.read()
            if (controller.signal.aborted) break
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const split = buffer.split(/\r?\n\r?\n/)
            buffer = split.pop() ?? ''
            for (const frame of split) dispatchAtlasAiStreamFrame(frame, streamHandlers)
          }

          if (controller.signal.aborted) break
          buffer += decoder.decode()
          for (const frame of parseAtlasAiSseFrames(buffer)) dispatchAtlasAiStreamFrame(frame, streamHandlers)
        }

        if (!completed && !controller.signal.aborted && attempt < maxReconnects) {
          await abortableDelay(Math.min(500 * (attempt + 1), 2000), controller.signal)
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) config.handlers.onError?.(error)
    }
  })()

  return {
    cancel: () => controller.abort(),
  }
}

export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}

export function parseAtlasAiSseFrames(text: string): string[] {
  return text.split(/\r?\n\r?\n/).map((frame) => frame.trim()).filter(Boolean)
}

export function dispatchAtlasAiStreamFrame(frame: string, handlers: AtlasAiStreamHandlers): void {
  let eventName = 'message'
  const dataLines: string[] = []

  for (const rawLine of frame.split(/\n/)) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }

  if (dataLines.length === 0) return

  let payload: unknown
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    return
  }

  if (eventName === 'done') {
    const done = payload as Partial<AtlasAiStreamDone>
    if (typeof done.trace_id === 'string' && typeof done.status === 'string') {
      handlers.onDone?.(done as AtlasAiStreamDone)
    }
    return
  }

  if (eventName === 'error') {
    handlers.onError?.(payload)
    return
  }

  if (eventName === 'heartbeat' || eventName === 'timeout') return

  const event = payload as Partial<AtlasAiStreamEvent>
  if (typeof event.trace_id !== 'string' || typeof event.sequence !== 'number') return

  handlers.onEvent?.({
    ...event,
    type: typeof event.type === 'string' ? event.type : eventName,
    content: typeof event.content === 'string' ? event.content : '',
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {},
  } as AtlasAiStreamEvent)
}
