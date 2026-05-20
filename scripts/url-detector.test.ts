import assert from 'node:assert/strict'
import { classifyUrl, extractUrls } from '../lib/richInput/urlDetector'

// ─── extractUrls ─────────────────────────────────────────────────────

assert.deepEqual(extractUrls(''), [])
assert.deepEqual(extractUrls('sem url aqui'), [])

assert.deepEqual(
  extractUrls('confere https://example.com/abc e https://docs.x'),
  ['https://example.com/abc', 'https://docs.x'],
)

// Deduplicação
assert.deepEqual(
  extractUrls('https://x.com e https://x.com'),
  ['https://x.com'],
)

// http E https aceitos
assert.deepEqual(
  extractUrls('mistura http://a.com com https://b.com'),
  ['http://a.com', 'https://b.com'],
)

// Trim pontuação final
const trailingCharsExtract = extractUrls('vê https://example.com)')
assert.equal(trailingCharsExtract.length, 1)
assert.ok(trailingCharsExtract[0].startsWith('https://example.com'))

// ─── classifyUrl · YouTube ───────────────────────────────────────────

const youtubeWatch = classifyUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
assert.equal(youtubeWatch.kind, 'youtube')
assert.equal(youtubeWatch.refId, 'dQw4w9WgXcQ')

const youtubeShort = classifyUrl('https://youtu.be/dQw4w9WgXcQ')
assert.equal(youtubeShort.kind, 'youtube')
assert.equal(youtubeShort.refId, 'dQw4w9WgXcQ')

const youtubeShorts = classifyUrl('https://www.youtube.com/shorts/abcdefghijk')
assert.equal(youtubeShorts.kind, 'youtube')
assert.equal(youtubeShorts.refId, 'abcdefghijk')

const youtubeLive = classifyUrl('https://www.youtube.com/live/ABCDEFGHIJK')
assert.equal(youtubeLive.kind, 'youtube')
assert.equal(youtubeLive.refId, 'ABCDEFGHIJK')

const youtubeEmbed = classifyUrl('https://www.youtube.com/embed/xyz_ABC1234')
assert.equal(youtubeEmbed.kind, 'youtube')
assert.equal(youtubeEmbed.refId, 'xyz_ABC1234')

// ─── classifyUrl · Vimeo ─────────────────────────────────────────────

const vimeoBasic = classifyUrl('https://vimeo.com/123456789')
assert.equal(vimeoBasic.kind, 'vimeo')
assert.equal(vimeoBasic.refId, '123456789')

const vimeoVideo = classifyUrl('https://vimeo.com/video/987654321')
assert.equal(vimeoVideo.kind, 'vimeo')
assert.equal(vimeoVideo.refId, '987654321')

const vimeoChannel = classifyUrl('https://vimeo.com/channels/staffpicks/445566778')
assert.equal(vimeoChannel.kind, 'vimeo')
assert.equal(vimeoChannel.refId, '445566778')

// ─── classifyUrl · GitHub ────────────────────────────────────────────

const githubRepo = classifyUrl('https://github.com/anthropic/claude-code')
assert.equal(githubRepo.kind, 'github')
assert.equal(githubRepo.refId, 'anthropic/claude-code')

const githubRepoWithGit = classifyUrl('https://github.com/owner/repo.git')
assert.equal(githubRepoWithGit.kind, 'github')
assert.equal(githubRepoWithGit.refId, 'owner/repo')

const githubFile = classifyUrl('https://github.com/owner/repo/blob/main/src/index.ts')
assert.equal(githubFile.kind, 'github')
assert.equal(githubFile.refId, 'owner/repo')

// ─── classifyUrl · generic fallback ──────────────────────────────────

const generic = classifyUrl('https://anthropic.com/news')
assert.equal(generic.kind, 'generic')
assert.equal(generic.refId, null)

const docs = classifyUrl('https://docs.atlas.local/specs/intent-kernel.md')
assert.equal(docs.kind, 'generic')

console.log('✓ urlDetector tests passaram')
