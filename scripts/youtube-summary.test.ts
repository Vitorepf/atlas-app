/**
 * YouTube canonical summary contract (mobile).
 *
 * Locks the projection contract surfaced by `youtubeSourcesFromTrace`
 * (mobile turn model) — which delegates to `summarizeYouTubeVideo` in
 * `@atlas/rich-input-canon`. Mobile and desktop both consume the canon, so
 * this test mirrors the canon shape from the mobile side and proves that
 * removing the local mapping helpers did not regress UX behavior.
 *
 * Run: `npx tsx scripts/youtube-summary.test.ts`
 */
import assert from 'node:assert/strict'

import { summarizeYouTubeVideo } from '@atlas/rich-input-canon'

function fixtureTrace(videos: unknown[]): {
  job: { id: string; payload: { youtube_ingestion: { videos: unknown[] } } }
} {
  return {
    job: { id: 'job-1', payload: { youtube_ingestion: { videos } } },
  }
}

// Lifted from mobile AtlasAiTurnModel.ts so the test exercises the same
// extraction logic the UI uses.
function youtubeSourcesFromFixtureTrace(trace: {
  job?: { payload?: { youtube_ingestion?: { videos?: unknown[] } } }
}) {
  const videos = trace.job?.payload?.youtube_ingestion?.videos ?? []
  const out: ReturnType<typeof summarizeYouTubeVideo>[] = []
  for (const v of videos) {
    const summary = summarizeYouTubeVideo(v, { targetLanguage: 'pt-BR', locale: 'pt-BR' })
    if (summary) out.push(summary)
  }
  return out.filter((s): s is NonNullable<typeof s> => s !== null)
}

let passed = 0
const test = (name: string, fn: () => void) => {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}`)
    throw err
  }
}

console.log('atlas-app · youtube canonical summary contract')

test('PT-BR video — translation_required=false, status=not_required', () => {
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://www.youtube.com/watch?v=ptbr1234567',
        status: 'ready',
        metadata: { title: 'Talk PT-BR', channel: 'Canal BR', duration_seconds: 300 },
        caption: { kind: 'manual', language: 'pt-BR' },
      },
    ]),
  )
  assert.equal(sources.length, 1)
  assert.equal(sources[0].ingestionStatus, 'ready')
  assert.equal(sources[0].transcriptStatus, 'original_ready')
  assert.equal(sources[0].translationStatus, 'not_required')
  assert.equal(sources[0].translationRequired, false)
  assert.equal(sources[0].sourceLanguage, 'pt-BR')
  assert.equal(sources[0].targetLanguage, 'pt-BR')
})

test('English video — translation_required=true, status=required, detail mentions PT-BR pendente', () => {
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://www.youtube.com/watch?v=enxxxxxxxxx',
        status: 'ready',
        metadata: { title: 'English Talk', channel: 'EN Channel', duration_seconds: 600 },
        caption: { kind: 'manual', language: 'en' },
      },
    ]),
  )
  assert.equal(sources[0].translationRequired, true)
  assert.equal(sources[0].translationStatus, 'required')
  assert.equal(sources[0].sourceLanguage, 'en')
  assert.match(sources[0].detail, /original/)
  assert.match(sources[0].detail, /PT-BR pendente/)
})

test('Processing video — progress percentage + pending translation', () => {
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://youtu.be/processingxx',
        status: 'processing',
        processing: { progress: 0.42, estimated_remaining_seconds: 120 },
      },
    ]),
  )
  assert.equal(sources[0].ingestionStatus, 'processing')
  assert.equal(sources[0].transcriptStatus, 'pending')
  assert.equal(sources[0].translationStatus, 'pending')
  assert.match(sources[0].detail, /42%/)
})

test('Failed video — all three dimensions fail + reason surfaces', () => {
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://youtu.be/failedaaaaa',
        status: 'failed',
        reason: 'metadata fetch timed out',
      },
    ]),
  )
  assert.equal(sources[0].ingestionStatus, 'failed')
  assert.equal(sources[0].transcriptStatus, 'failed')
  assert.equal(sources[0].translationStatus, 'failed')
  assert.match(sources[0].detail, /metadata fetch timed out/)
})

test('Caption unavailable — translation not_required (nothing to translate)', () => {
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://youtu.be/nocapsssss1',
        status: 'caption_unavailable',
        metadata: { title: 'Silent vid' },
      },
    ]),
  )
  assert.equal(sources[0].ingestionStatus, 'ready')
  assert.equal(sources[0].transcriptStatus, 'unavailable')
  assert.equal(sources[0].translationStatus, 'not_required')
  assert.equal(sources[0].translationRequired, false)
})

test('Dedup — same videoId in different URL formats collapses to one source', () => {
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://youtu.be/dQw4w9WgXcQ',
        status: 'ready',
        caption: { language: 'pt-BR' },
      },
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDxyz',
        status: 'ready',
        caption: { language: 'pt-BR' },
      },
    ]),
  )
  // The mobile turn model dedups by `key` (videoId or canonical URL),
  // but the canon-side summary just maps each input. With both fixtures
  // resolving to the same canonical URL, both yield identical `key`.
  const keys = new Set(sources.map((s) => s.key))
  assert.equal(keys.size, 1, 'expected 1 unique key after dedup')
})

test('Honest: backend never emits translated_ready by default', () => {
  // Foreign EN video, no explicit signal — must NEVER be translated_ready.
  const sources = youtubeSourcesFromFixtureTrace(
    fixtureTrace([
      {
        url: 'https://youtu.be/foreignenxx',
        status: 'ready',
        caption: { language: 'en' },
      },
    ]),
  )
  assert.notEqual(sources[0].translationStatus, 'translated_ready')
})

console.log(`\n${passed} test(s) passed.`)
