/**
 * Slice 5 · integração badge canon na UI existente.
 *
 * Valida que `attachmentBadgeLabel` (consumido por `FileAttachmentPreviewStrip`
 * em AtlasAiAttachments.tsx) produz labels canon premium quando há mimeType,
 * e cai pro legacy `fileExtensionLabel` quando MIME ausente.
 *
 * Antes Slice 5: todos os files virariam "PDF"/"TSX"/"FILE" (extensão crua).
 * Pós Slice 5: "PDF"/"TSX"/"Python"/"Docker"/"Markdown"/"JSON"/etc.
 */
import assert from 'node:assert/strict'
import {
  attachmentBadgeLabel,
  fileExtensionLabel,
} from '../components/sheets/atlas-ai/attachmentTypes'

// ─── Legacy fileExtensionLabel · unchanged ───────────────────────────

assert.equal(fileExtensionLabel('report.pdf'), 'PDF')
assert.equal(fileExtensionLabel('App.tsx'), 'TSX')
assert.equal(fileExtensionLabel('handler.ts'), 'TS')
assert.equal(fileExtensionLabel('arquivo'), 'FILE', 'sem extensão → FILE')
assert.equal(fileExtensionLabel('a.verylongext'), 'FILE', 'extensão >5 chars → FILE')

// ─── Canon badge com mimeType · usa formatAttachmentBadge ────────────

assert.equal(attachmentBadgeLabel('report.pdf', 'application/pdf'), 'PDF')
assert.equal(attachmentBadgeLabel('photo.jpg', 'image/jpeg'), 'JPEG')
assert.equal(attachmentBadgeLabel('shot.png', 'image/png'), 'PNG')
assert.equal(attachmentBadgeLabel('meme.gif', 'image/gif'), 'GIF')
assert.equal(attachmentBadgeLabel('thumb.webp', 'image/webp'), 'WEBP')

// Code com linguagem · GANHA vs fileExtensionLabel
assert.equal(attachmentBadgeLabel('handler.ts', 'text/x-typescript'), 'TypeScript')
assert.equal(attachmentBadgeLabel('handler.ts', 'text/plain'), 'TypeScript', 'ext py vence mime genérico')
assert.equal(attachmentBadgeLabel('App.tsx', 'text/plain'), 'TSX')
assert.equal(attachmentBadgeLabel('script.py', 'application/octet-stream'), 'Python')
assert.equal(attachmentBadgeLabel('main.rs', 'text/plain'), 'Rust')
assert.equal(attachmentBadgeLabel('handler.go', 'text/plain'), 'Go')
assert.equal(attachmentBadgeLabel('Dockerfile', 'text/plain'), 'Docker')
assert.equal(attachmentBadgeLabel('config.json', 'application/json'), 'JSON')
assert.equal(attachmentBadgeLabel('feed.xml', 'application/xml'), 'XML')

// Markdown → text com label 'Markdown'
assert.equal(attachmentBadgeLabel('README.md', 'text/markdown'), 'Markdown')

// Text genérico
assert.equal(attachmentBadgeLabel('notes.txt', 'text/plain'), 'TEXT')

// ─── Fallback · sem mimeType cai pro legacy ──────────────────────────

assert.equal(attachmentBadgeLabel('report.pdf'), 'PDF', 'sem mime cai pro legacy')
assert.equal(attachmentBadgeLabel('App.tsx'), 'TSX', 'sem mime cai pro legacy')
assert.equal(attachmentBadgeLabel('arquivo'), 'FILE', 'sem mime sem ext → FILE')
assert.equal(attachmentBadgeLabel('report.pdf', null), 'PDF', 'mime=null cai pro legacy')
assert.equal(attachmentBadgeLabel('report.pdf', undefined), 'PDF', 'mime=undefined cai pro legacy')

// ─── Anti-regressão · diff esperado vs legacy ────────────────────────

// Onde V1 e canon DIVERGEM (canon é melhor):
assert.notEqual(
  attachmentBadgeLabel('handler.py', 'text/plain'),
  fileExtensionLabel('handler.py'),
  'canon retorna "Python" vs legacy "PY"',
)
assert.notEqual(
  attachmentBadgeLabel('Dockerfile', 'text/plain'),
  fileExtensionLabel('Dockerfile'),
  'canon retorna "Docker" vs legacy "FILE"',
)
assert.notEqual(
  attachmentBadgeLabel('Makefile', 'text/plain'),
  fileExtensionLabel('Makefile'),
)

// Onde V1 e canon CONCORDAM (extensões já uppercase):
assert.equal(attachmentBadgeLabel('App.tsx', 'text/plain'), 'TSX')
assert.equal(fileExtensionLabel('App.tsx'), 'TSX')

console.log('✓ attachment badge integration tests passaram')
