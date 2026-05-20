/**
 * Atlas AI · Mobile · YouTube prewarm pure helpers contract.
 *
 * Locks the canon-driven extraction + dedup logic that feeds the
 * `useYoutubePrewarm` hook. The hook itself depends on React + the API
 * client, so we test the pure helpers in isolation and lean on the
 * backend's own feature test for end-to-end coverage.
 */
import assert from 'node:assert/strict'

import { diffNewVideoIds, extractYoutubeLinks } from '../lib/atlasAi/youtubePrewarm'

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

console.log('atlas-app · youtube paste-time prewarm helpers')

test('extractYoutubeLinks · empty/null/whitespace yields []', () => {
  assert.deepEqual(extractYoutubeLinks(''), [])
  assert.deepEqual(extractYoutubeLinks(null), [])
  assert.deepEqual(extractYoutubeLinks(undefined), [])
  assert.deepEqual(extractYoutubeLinks('   '), [])
  assert.deepEqual(extractYoutubeLinks('sem nenhum link aqui'), [])
})

test('extractYoutubeLinks · canonical watch URL', () => {
  const out = extractYoutubeLinks('analisa isso https://www.youtube.com/watch?v=dQw4w9WgXcQ por favor')
  assert.equal(out.length, 1)
  assert.equal(out[0].canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert.equal(out[0].videoId, 'dQw4w9WgXcQ')
})

test('extractYoutubeLinks · youtu.be normalizes to canonical', () => {
  const out = extractYoutubeLinks('cola https://youtu.be/dQw4w9WgXcQ')
  assert.equal(out[0].canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
})

test('extractYoutubeLinks · shorts/live/embed all collapse to watch', () => {
  const out = extractYoutubeLinks([
    'https://www.youtube.com/shorts/abc12345678',
    'https://www.youtube.com/live/def12345678',
    'https://www.youtube.com/embed/ghi12345678',
  ].join(' '))
  assert.equal(out.length, 3)
  assert.equal(out[0].canonicalUrl, 'https://www.youtube.com/watch?v=abc12345678')
  assert.equal(out[1].canonicalUrl, 'https://www.youtube.com/watch?v=def12345678')
  assert.equal(out[2].canonicalUrl, 'https://www.youtube.com/watch?v=ghi12345678')
})

test('extractYoutubeLinks · dedups same videoId regardless of URL format', () => {
  const out = extractYoutubeLinks([
    'https://youtu.be/dQw4w9WgXcQ',
    'e tambem https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDxyz',
    'e ainda https://www.youtube.com/shorts/dQw4w9WgXcQ',
  ].join(' '))
  assert.equal(out.length, 1)
  assert.equal(out[0].videoId, 'dQw4w9WgXcQ')
})

test('extractYoutubeLinks · ignores non-YouTube', () => {
  const out = extractYoutubeLinks('cola https://example.com e https://github.com/x/y aqui')
  assert.deepEqual(out, [])
})

test('extractYoutubeLinks · ignores youtube search/channel URLs', () => {
  const out = extractYoutubeLinks(
    'https://www.youtube.com/results?q=foo https://www.youtube.com/@channel',
  )
  assert.deepEqual(out, [])
})

test('extractYoutubeLinks · multiple distinct videos preserve order', () => {
  const out = extractYoutubeLinks(
    'primeiro https://youtu.be/aaaaaaaaaaa segundo https://youtu.be/bbbbbbbbbbb',
  )
  assert.equal(out.length, 2)
  assert.equal(out[0].videoId, 'aaaaaaaaaaa')
  assert.equal(out[1].videoId, 'bbbbbbbbbbb')
})

test('diffNewVideoIds · empty alreadyPrewarmed returns everything', () => {
  const links = [
    { canonicalUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', videoId: 'aaaaaaaaaaa' },
    { canonicalUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb', videoId: 'bbbbbbbbbbb' },
  ]
  assert.equal(diffNewVideoIds(links, new Set()).length, 2)
})

test('diffNewVideoIds · skips ones already in alreadyPrewarmed', () => {
  const links = [
    { canonicalUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', videoId: 'aaaaaaaaaaa' },
    { canonicalUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb', videoId: 'bbbbbbbbbbb' },
  ]
  const result = diffNewVideoIds(links, new Set(['aaaaaaaaaaa']))
  assert.equal(result.length, 1)
  assert.equal(result[0].videoId, 'bbbbbbbbbbb')
})

test('diffNewVideoIds · everything prewarmed yields empty', () => {
  const links = [
    { canonicalUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', videoId: 'aaaaaaaaaaa' },
  ]
  assert.deepEqual(diffNewVideoIds(links, new Set(['aaaaaaaaaaa'])), [])
})

console.log(`\n${passed} test(s) passed.`)
