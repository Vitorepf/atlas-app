import assert from 'node:assert/strict'
import {
  ATLAS_RICH_INPUT_PAYLOAD_SCHEMA,
  ATTACHMENT_LIMITS,
  CODE_LANG_BY_EXT,
  SUPPORTED_IMAGE_MIME,
  SUPPORTED_PDF_MIME,
  SUPPORTED_TEXT_MIME_PREFIXES,
  detectLanguageFromFilename,
} from '../lib/richInput/types'
import {
  estimateRichInputTokens,
  formatRichInputSummary,
  summarizeRichInputDrafts,
} from '../lib/richInput/metrics'
import type { AttachmentDraft, CodeAttachment, ImageAttachment, PdfAttachment, TextAttachment, UrlAttachment } from '../lib/richInput/types'

// ─── Schema canon ────────────────────────────────────────────────────

assert.equal(ATLAS_RICH_INPUT_PAYLOAD_SCHEMA, 'atlas.rich_input.payload.v1')

// ─── ATTACHMENT_LIMITS canon (sincronizado com backend) ──────────────

assert.equal(ATTACHMENT_LIMITS.maxImages, 8, 'backend canon: 8 imgs')
assert.equal(ATTACHMENT_LIMITS.maxPdfs, 4, 'backend canon: 4 PDFs')
assert.equal(ATTACHMENT_LIMITS.maxTextFiles, 8)
assert.equal(ATTACHMENT_LIMITS.maxUrls, 16)
assert.equal(ATTACHMENT_LIMITS.maxImageBytes, 20 * 1024 * 1024)
assert.equal(ATTACHMENT_LIMITS.maxPdfBytes, 20 * 1024 * 1024)
assert.equal(ATTACHMENT_LIMITS.maxTextBytes, 4 * 1024 * 1024)
assert.equal(ATTACHMENT_LIMITS.maxImageDimension, 2048)
assert.equal(ATTACHMENT_LIMITS.chunkSize, 1.5 * 1024 * 1024)

// ─── MIME sets ───────────────────────────────────────────────────────

assert.ok(SUPPORTED_IMAGE_MIME.has('image/png'))
assert.ok(SUPPORTED_IMAGE_MIME.has('image/jpeg'))
assert.ok(SUPPORTED_IMAGE_MIME.has('image/webp'))
assert.ok(SUPPORTED_IMAGE_MIME.has('image/gif'))
assert.ok(!SUPPORTED_IMAGE_MIME.has('image/tiff'), 'tiff não suportado')
assert.ok(SUPPORTED_PDF_MIME.has('application/pdf'))
assert.deepEqual(SUPPORTED_TEXT_MIME_PREFIXES, ['text/', 'application/json', 'application/xml'])

// ─── CODE_LANG_BY_EXT ────────────────────────────────────────────────

assert.equal(CODE_LANG_BY_EXT.ts, 'typescript')
assert.equal(CODE_LANG_BY_EXT.tsx, 'tsx')
assert.equal(CODE_LANG_BY_EXT.py, 'python')
assert.equal(CODE_LANG_BY_EXT.rs, 'rust')
assert.equal(CODE_LANG_BY_EXT.swift, 'swift')

// ─── detectLanguageFromFilename ──────────────────────────────────────

assert.equal(detectLanguageFromFilename('handler.ts'), 'typescript')
assert.equal(detectLanguageFromFilename('App.tsx'), 'tsx')
assert.equal(detectLanguageFromFilename('script.py'), 'python')
assert.equal(detectLanguageFromFilename('README.md'), 'markdown')
assert.equal(detectLanguageFromFilename('Dockerfile'), 'docker')
assert.equal(detectLanguageFromFilename('Makefile'), 'makefile')
assert.equal(detectLanguageFromFilename('path/Dockerfile'), 'docker')
assert.equal(detectLanguageFromFilename('arquivo-sem-extensao'), null)

// ─── estimateRichInputTokens · text only ─────────────────────────────

assert.equal(estimateRichInputTokens(''), 0, 'texto vazio = 0 tokens')
assert.equal(estimateRichInputTokens('   '), 0, 'whitespace = 0 tokens')
const shortText = estimateRichInputTokens('hello world')
assert.ok(shortText >= 1 && shortText <= 5, '~3 tokens para 11 chars')
const longText = estimateRichInputTokens('a'.repeat(400))
assert.equal(longText, 100, '400 chars = 100 tokens')

// ─── estimateRichInputTokens com attachments ─────────────────────────

function makeImage(): ImageAttachment {
  return {
    id: 'img-1',
    kind: 'image',
    status: 'ready',
    fileName: 'screenshot.png',
    size: 200_000,
    mimeType: 'image/png',
    createdAt: Date.now(),
    error: null,
    progress: 1,
    uploadedId: null,
    previewDataUrl: 'data:image/png;base64,',
    blob: new Blob(),
    width: 800,
    height: 600,
    originalSize: 250_000,
    source: 'picker',
  }
}

function makePdf(pageCount: number, extractedText = ''): PdfAttachment {
  return {
    id: 'pdf-1',
    kind: 'pdf',
    status: 'ready',
    fileName: 'doc.pdf',
    size: 5_000_000,
    mimeType: 'application/pdf',
    createdAt: Date.now(),
    error: null,
    progress: 1,
    uploadedId: null,
    blob: new Blob(),
    pageCount,
    thumbnailDataUrl: null,
    extractedText,
    textLength: extractedText.length,
    source: 'picker',
  }
}

function makeCode(content: string): CodeAttachment {
  return {
    id: 'code-1',
    kind: 'code',
    status: 'ready',
    fileName: 'handler.ts',
    size: content.length,
    mimeType: 'text/x-typescript',
    createdAt: Date.now(),
    error: null,
    progress: 1,
    uploadedId: null,
    blob: new Blob(),
    content,
    language: 'typescript',
    source: 'picker',
  }
}

function makeText(content: string): TextAttachment {
  return {
    id: 'text-1',
    kind: 'text',
    status: 'ready',
    fileName: 'notes.md',
    size: content.length,
    mimeType: 'text/markdown',
    createdAt: Date.now(),
    error: null,
    progress: 1,
    uploadedId: null,
    blob: new Blob(),
    content,
    language: 'markdown',
    source: 'picker',
  }
}

function makeUrl(): UrlAttachment {
  return {
    id: 'url-1',
    kind: 'url',
    status: 'ready',
    fileName: 'youtube.com/watch',
    size: 0,
    mimeType: 'text/uri-list',
    createdAt: Date.now(),
    error: null,
    progress: 1,
    uploadedId: null,
    url: 'https://www.youtube.com/watch?v=xyz',
    urlKind: 'youtube',
    title: 'How to Debug',
    thumbnailUrl: null,
    author: null,
    durationSec: 1245,
    refId: 'xyz',
    source: 'paste',
  }
}

// Image: 1200 tokens fixos
const withImage = estimateRichInputTokens('', [makeImage()])
assert.equal(withImage, 1200)

// PDF sem extracted text: max(600, pageCount * 700)
const pdfNoText = estimateRichInputTokens('', [makePdf(5)])
assert.equal(pdfNoText, 3500, 'PDF 5 páginas sem texto = 5 × 700 = 3500')
const pdfSinglePage = estimateRichInputTokens('', [makePdf(0)])
assert.equal(pdfSinglePage, 600, 'PDF 0 páginas = min 600')

// PDF com extracted text: usa text length / 4
const pdfWithText = estimateRichInputTokens('', [makePdf(10, 'a'.repeat(2000))])
assert.equal(pdfWithText, 500, 'PDF com 2000 chars extracted = 500 tokens')

// Code/text: content / 4
const withCode = estimateRichInputTokens('', [makeCode('const x = 1\n'.repeat(50))])
assert.equal(withCode, Math.round((12 * 50) / 4), 'code content / 4')

// URL: 100 tokens fixos
const withUrl = estimateRichInputTokens('', [makeUrl()])
assert.equal(withUrl, 100)

// Combo
const combo = estimateRichInputTokens('test query', [makeImage(), makeUrl(), makePdf(2)])
// text "test query" = 10 chars / 4 = ~3 (Math.round(10/4)=3)
// image = 1200, url = 100, pdf 2 pages = 1400
assert.equal(combo, 3 + 1200 + 100 + 1400)

// Error draft é ignorado
const errored: AttachmentDraft = { ...makeImage(), status: 'error', error: 'failed' }
const withError = estimateRichInputTokens('', [errored])
assert.equal(withError, 0, 'draft em error não conta')

// ─── summarizeRichInputDrafts ────────────────────────────────────────

const summary = summarizeRichInputDrafts([
  makeImage(), makeImage(),
  makePdf(3),
  makeCode('x'),
  makeUrl(), makeUrl(), makeUrl(),
])
// Canon shape exposes singular kind keys + plural aliases + total — the
// extra keys are part of the universal contract (see @atlas/rich-input-canon).
assert.deepEqual(summary, {
  image: 2,
  pdf: 1,
  text: 0,
  code: 1,
  url: 3,
  total: 7,
  images: 2,
  pdfs: 1,
  urls: 3,
})

// Error filtrado
const summaryWithError = summarizeRichInputDrafts([
  makeImage(),
  { ...makeImage(), status: 'error', error: 'x' },
])
assert.equal(summaryWithError.image, 1, 'error não conta')

// ─── formatRichInputSummary ──────────────────────────────────────────

assert.equal(formatRichInputSummary({ image: 0, pdf: 0, text: 0, code: 0, url: 0 }), '')
assert.equal(formatRichInputSummary({ image: 2, pdf: 0, text: 0, code: 0, url: 0 }), '2 img')
assert.equal(formatRichInputSummary({ image: 1, pdf: 1, text: 0, code: 0, url: 3 }), '1 img · 1 pdf · 3 url')
assert.equal(
  formatRichInputSummary({ image: 1, pdf: 1, text: 2, code: 3, url: 4 }),
  '1 img · 1 pdf · 2 txt · 3 code · 4 url',
)

console.log('✓ rich-input types + metrics tests passaram')
