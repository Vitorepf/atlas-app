import assert from 'node:assert/strict'
import { createAtlasAiInteractionStream } from '../lib/atlasAiStreamRuntime'

type FetchCall = {
  url: string
  init?: RequestInit
}

const originalFetch = globalThis.fetch

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function main(): Promise<void> {
  {
    const calls: FetchCall[] = []
    const frames = [
      'event: message\ndata: {"trace_id":"trace-stream","sequence":3,"type":"token","channel":"assistant","content":"Oi"}',
      'event: done\ndata: {"trace_id":"trace-stream","status":"succeeded","last_sequence":3}',
    ].join('\n\n')

    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init })
      return {
        ok: true,
        url: String(url),
        body: null,
        text: async () => frames,
      }
    }) as typeof fetch

    const events: string[] = []
    let doneStatus: string | null = null

    createAtlasAiInteractionStream({
      traceId: 'trace-stream',
      handlers: {
        onEvent: (event) => events.push(`${event.sequence}:${event.content}`),
        onDone: (event) => {
          doneStatus = event.status
        },
        onError: (error) => {
          throw error
        },
      },
      options: { after: 2, maxReconnects: 0 },
      getApiBase: () => 'http://atlas.local',
      getAuthHeaders: () => ({ 'X-Atlas-Token': 'test-token' }),
      fetchImpl: globalThis.fetch,
    })

    await waitForMicrotasks()
    await waitForMicrotasks()

    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /\/ai\/interactions\/trace-stream\/stream\?/)
    assert.match(calls[0].url, /after=2/)
    assert.equal((calls[0].init?.headers as Record<string, string>).Accept, 'text/event-stream')
    assert.deepEqual(events, ['3:Oi'])
    assert.equal(doneStatus, 'succeeded')
  }

  {
    const calls: FetchCall[] = []
    const responses = [
      'event: message\ndata: {"trace_id":"trace-reconnect","sequence":8,"type":"token","channel":"assistant","content":"A"}',
      'event: done\ndata: {"trace_id":"trace-reconnect","status":"succeeded","last_sequence":8}',
    ]

    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init })
      return {
        ok: true,
        url: String(url),
        body: null,
        text: async () => responses.shift() ?? '',
      }
    }) as typeof fetch

    const events: string[] = []
    let doneStatus: string | null = null

    createAtlasAiInteractionStream({
      traceId: 'trace-reconnect',
      handlers: {
        onEvent: (event) => events.push(event.content ?? ''),
        onDone: (event) => {
          doneStatus = event.status
        },
        onError: (error) => {
          throw error
        },
      },
      options: { after: 7, maxReconnects: 1 },
      getApiBase: () => 'http://atlas.local',
      getAuthHeaders: () => ({}),
      fetchImpl: globalThis.fetch,
    })

    await new Promise((resolve) => setTimeout(resolve, 620))

    assert.equal(calls.length, 2)
    assert.match(calls[0].url, /after=7/)
    assert.match(calls[1].url, /after=8/)
    assert.deepEqual(events, ['A'])
    assert.equal(doneStatus, 'succeeded')
  }

  {
    const calls: FetchCall[] = []
    const responses = [
      [
        'event: message\ndata: {"trace_id":"trace-other","sequence":20,"type":"token","channel":"assistant","content":"wrong"}',
        'event: done\ndata: {"trace_id":"trace-other","status":"succeeded","last_sequence":20}',
      ].join('\n\n'),
      'event: done\ndata: {"trace_id":"trace-target","status":"succeeded","last_sequence":4}',
    ]

    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init })
      return {
        ok: true,
        url: String(url),
        body: null,
        text: async () => responses.shift() ?? '',
      }
    }) as typeof fetch

    const events: string[] = []
    let doneStatus: string | null = null

    createAtlasAiInteractionStream({
      traceId: 'trace-target',
      handlers: {
        onEvent: (event) => events.push(event.content ?? ''),
        onDone: (event) => {
          doneStatus = event.status
        },
        onError: (error) => {
          throw error
        },
      },
      options: { after: 4, maxReconnects: 1 },
      getApiBase: () => 'http://atlas.local',
      getAuthHeaders: () => ({}),
      fetchImpl: globalThis.fetch,
    })

    await new Promise((resolve) => setTimeout(resolve, 620))

    assert.equal(calls.length, 2)
    assert.match(calls[0].url, /after=4/)
    assert.match(calls[1].url, /after=4/)
    assert.deepEqual(events, [])
    assert.equal(doneStatus, 'succeeded')
  }

  {
    const state: {
      fetchSignal?: AbortSignal
      resolveText?: (value: string) => void
    } = {}
    const events: string[] = []
    let doneCalled = false
    let errorCalled = false

    globalThis.fetch = (async (_url, init) => {
      if (init?.signal instanceof AbortSignal) state.fetchSignal = init.signal
      return {
        ok: true,
        url: String(_url),
        body: null,
        text: () => new Promise<string>((resolve) => {
          state.resolveText = resolve
        }),
      }
    }) as typeof fetch

    const stream = createAtlasAiInteractionStream({
      traceId: 'trace-cancelled',
      handlers: {
        onEvent: (event) => events.push(event.content ?? ''),
        onDone: () => {
          doneCalled = true
        },
        onError: () => {
          errorCalled = true
        },
      },
      options: { maxReconnects: 0 },
      getApiBase: () => 'http://atlas.local',
      getAuthHeaders: () => ({}),
      fetchImpl: globalThis.fetch,
    })

    await waitForMicrotasks()
    stream.cancel()

    assert.equal(state.fetchSignal?.aborted, true)
    assert.ok(state.resolveText)
    state.resolveText('event: message\ndata: {"trace_id":"trace-cancelled","sequence":1,"type":"token","content":"late"}')
    await waitForMicrotasks()

    assert.deepEqual(events, [])
    assert.equal(doneCalled, false)
    assert.equal(errorCalled, false)
  }
}

main()
  .then(() => {
    console.info('atlas ai streaming tests passed')
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
  })
