import assert from 'node:assert/strict'
import { detectAttachmentKind, formatAttachmentBadge } from '../lib/richInput/attachmentKind'

// ─── Image detection ─────────────────────────────────────────────────

assert.equal(detectAttachmentKind('image/png', 'screenshot.png').kind, 'image')
assert.equal(detectAttachmentKind('image/jpeg', 'photo.jpg').kind, 'image')
assert.equal(detectAttachmentKind('image/webp', 'asset.webp').kind, 'image')
assert.equal(detectAttachmentKind('image/gif', 'meme.gif').kind, 'image')

// ─── PDF detection ───────────────────────────────────────────────────

const pdf = detectAttachmentKind('application/pdf', 'report.pdf')
assert.equal(pdf.kind, 'pdf')
assert.equal(pdf.language, null)
assert.equal(pdf.reason, 'mime:application/pdf')

// ─── Code detection · linguagem específica ───────────────────────────

const tsFile = detectAttachmentKind('text/x-typescript', 'handler.ts')
assert.equal(tsFile.kind, 'code')
assert.equal(tsFile.language, 'typescript')

const tsxFile = detectAttachmentKind('text/plain', 'Composer.tsx')
assert.equal(tsxFile.kind, 'code')
assert.equal(tsxFile.language, 'tsx')

const pyFile = detectAttachmentKind('application/octet-stream', 'script.py')
assert.equal(pyFile.kind, 'code', 'extensão py vence MIME genérico')
assert.equal(pyFile.language, 'python')

const rustFile = detectAttachmentKind('text/plain', 'main.rs')
assert.equal(rustFile.kind, 'code')
assert.equal(rustFile.language, 'rust')

const dockerfile = detectAttachmentKind('text/plain', 'Dockerfile')
assert.equal(dockerfile.kind, 'code')
assert.equal(dockerfile.language, 'docker')

// ─── Markdown · vira text (não code) ─────────────────────────────────

const md = detectAttachmentKind('text/markdown', 'README.md')
assert.equal(md.kind, 'text')
assert.equal(md.language, 'markdown')

// ─── Text genérico ───────────────────────────────────────────────────

const txt = detectAttachmentKind('text/plain', 'notes.txt')
assert.equal(txt.kind, 'text')
assert.equal(txt.language, null)

const json = detectAttachmentKind('application/json', 'config.json')
assert.equal(json.kind, 'code', 'JSON é code via extensão CODE_LANG_BY_EXT')
assert.equal(json.language, 'json')

const xml = detectAttachmentKind('application/xml', 'feed.xml')
assert.equal(xml.kind, 'code')
assert.equal(xml.language, 'xml')

// ─── Fallback ────────────────────────────────────────────────────────

const unknown = detectAttachmentKind('application/octet-stream', 'arquivo-sem-extensao')
assert.equal(unknown.kind, 'text', 'fallback safer: text')
assert.equal(unknown.reason, 'fallback:application/octet-stream')

// ─── formatAttachmentBadge ───────────────────────────────────────────

assert.equal(formatAttachmentBadge(detectAttachmentKind('image/png', 'a.png'), 'image/png'), 'PNG')
assert.equal(formatAttachmentBadge(detectAttachmentKind('image/jpeg', 'a.jpg'), 'image/jpeg'), 'JPEG')
assert.equal(formatAttachmentBadge(detectAttachmentKind('image/webp', 'a.webp'), 'image/webp'), 'WEBP')
assert.equal(formatAttachmentBadge(detectAttachmentKind('application/pdf', 'a.pdf')), 'PDF')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/x-typescript', 'a.ts')), 'TypeScript')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/plain', 'a.tsx')), 'TSX')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/plain', 'a.py')), 'Python')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/plain', 'a.rs')), 'Rust')
assert.equal(formatAttachmentBadge(detectAttachmentKind('application/json', 'a.json')), 'JSON')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/markdown', 'a.md')), 'Markdown')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/plain', 'notes.txt')), 'TEXT')
assert.equal(formatAttachmentBadge(detectAttachmentKind('text/plain', 'Dockerfile')), 'Docker')

console.log('✓ attachmentKind detection tests passaram')
