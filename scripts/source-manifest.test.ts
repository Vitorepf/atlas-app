import assert from 'node:assert/strict'
import {
  buildManifestEntry,
  buildRichInputPayload,
  buildSourceManifest,
  type ManifestAttachmentLike,
} from '../lib/richInput/sourceManifest'
import { ATLAS_RICH_INPUT_PAYLOAD_SCHEMA } from '../lib/richInput/types'

// ─── buildManifestEntry · image ──────────────────────────────────────

const imgAttachment: ManifestAttachmentLike = {
  id: 'img-id-1',
  uri: 'file:///cache/photo.png',
  fileName: 'screenshot.png',
  mimeType: 'image/png',
  size: 524_288,
  source: 'photos',
}

const imgEntry = buildManifestEntry(imgAttachment, 'uploaded-img-uuid-1', 'image')
assert.equal(imgEntry.id, 'img-id-1', 'preserva id quando provided')
assert.equal(imgEntry.kind, 'image')
assert.equal(imgEntry.file_name, 'screenshot.png')
assert.equal(imgEntry.mime_type, 'image/png')
assert.equal(imgEntry.size, 524_288)
assert.equal(imgEntry.uploaded_id, 'uploaded-img-uuid-1')
assert.equal(imgEntry.source_hash, null, 'mobile não computa SHA-256')
assert.equal(imgEntry.source, 'photos')

// ─── buildManifestEntry · file (kind=pdf via detect) ────────────────

const pdfAttachment: ManifestAttachmentLike = {
  id: 'pdf-id-1',
  fileName: 'report.pdf',
  mimeType: 'application/pdf',
  size: 1_048_576,
  source: 'files',
}

const pdfEntry = buildManifestEntry(pdfAttachment, 'uploaded-doc-uuid-1', 'file')
assert.equal(pdfEntry.kind, 'pdf', 'application/pdf MIME → kind=pdf')
assert.equal(pdfEntry.file_name, 'report.pdf')
assert.equal(pdfEntry.uploaded_id, 'uploaded-doc-uuid-1')

// ─── buildManifestEntry · file (kind=code via extension) ─────────────

const codeAttachment: ManifestAttachmentLike = {
  id: 'code-id-1',
  fileName: 'handler.ts',
  mimeType: 'text/plain',
  size: 4096,
  source: 'files',
}

const codeEntry = buildManifestEntry(codeAttachment, 'uploaded-doc-uuid-2', 'file')
assert.equal(codeEntry.kind, 'code', 'handler.ts → kind=code via ext detection')
assert.equal(codeEntry.file_name, 'handler.ts')

// ─── buildManifestEntry · file (kind=text via markdown) ──────────────

const mdAttachment: ManifestAttachmentLike = {
  id: 'md-id-1',
  fileName: 'README.md',
  mimeType: 'text/markdown',
  size: 8192,
  source: 'files',
}

const mdEntry = buildManifestEntry(mdAttachment, 'uploaded-doc-uuid-3', 'file')
assert.equal(mdEntry.kind, 'text', 'markdown vira text (não code)')

// ─── ID estável quando attachment não tem id ─────────────────────────

const noIdAttachment: ManifestAttachmentLike = {
  uri: 'file:///cache/foo.png',
  fileName: 'foo.png',
  mimeType: 'image/png',
  size: 1000,
}

const entry1 = buildManifestEntry(noIdAttachment, 'up-1', 'image')
const entry2 = buildManifestEntry(noIdAttachment, 'up-1', 'image')
assert.equal(entry1.id, entry2.id, 'mesmo input → mesmo id (estável)')
assert.ok(entry1.id.startsWith('manifest-'), 'id gerado tem prefixo "manifest-"')

// IDs diferentes pra inputs diferentes
const diff: ManifestAttachmentLike = { ...noIdAttachment, fileName: 'bar.png' }
const entry3 = buildManifestEntry(diff, 'up-2', 'image')
assert.notEqual(entry1.id, entry3.id)

// ─── source default 'app' quando não provided ────────────────────────

const noSourceAttachment: ManifestAttachmentLike = {
  fileName: 'a.png',
  mimeType: 'image/png',
  size: 100,
}
const entryNoSource = buildManifestEntry(noSourceAttachment, null, 'image')
assert.equal(entryNoSource.source, 'app')
assert.equal(entryNoSource.uploaded_id, null, 'null upload propaga')

// ─── size default 0 quando ausente ───────────────────────────────────

const noSizeAttachment: ManifestAttachmentLike = {
  fileName: 'a.png',
  mimeType: 'image/png',
}
assert.equal(buildManifestEntry(noSizeAttachment, null, 'image').size, 0)

const zeroSizeAttachment: ManifestAttachmentLike = {
  ...noSizeAttachment,
  size: 0,
}
assert.equal(buildManifestEntry(zeroSizeAttachment, null, 'image').size, 0)

// ─── buildSourceManifest · ordem imagens primeiro, files depois ──────

const manifest = buildSourceManifest({
  imageAttachments: [
    { id: 'i1', fileName: 'a.png', mimeType: 'image/png', size: 100 },
    { id: 'i2', fileName: 'b.jpg', mimeType: 'image/jpeg', size: 200 },
  ],
  uploadedImageIds: ['up-img-1', 'up-img-2'],
  fileAttachments: [
    { id: 'f1', fileName: 'doc.pdf', mimeType: 'application/pdf', size: 1000 },
    { id: 'f2', fileName: 'note.md', mimeType: 'text/markdown', size: 500 },
  ],
  uploadedDocumentIds: ['up-doc-1', 'up-doc-2'],
})

assert.equal(manifest.length, 4, 'total = 2 img + 2 file')
assert.equal(manifest[0].id, 'i1', 'imagem primeiro')
assert.equal(manifest[0].kind, 'image')
assert.equal(manifest[0].uploaded_id, 'up-img-1')
assert.equal(manifest[1].id, 'i2')
assert.equal(manifest[1].uploaded_id, 'up-img-2')
assert.equal(manifest[2].id, 'f1')
assert.equal(manifest[2].kind, 'pdf')
assert.equal(manifest[2].uploaded_id, 'up-doc-1')
assert.equal(manifest[3].id, 'f2')
assert.equal(manifest[3].kind, 'text', 'markdown vira text')
assert.equal(manifest[3].uploaded_id, 'up-doc-2')

// ─── buildSourceManifest · uploaded ids pareados por index ──────────

const partialUpload = buildSourceManifest({
  imageAttachments: [
    { id: 'i1', fileName: 'a.png', mimeType: 'image/png', size: 100 },
    { id: 'i2', fileName: 'b.png', mimeType: 'image/png', size: 200 },
  ],
  uploadedImageIds: ['up-1'], // só 1 upload (incompleto)
  fileAttachments: [],
  uploadedDocumentIds: [],
})
assert.equal(partialUpload[0].uploaded_id, 'up-1')
assert.equal(partialUpload[1].uploaded_id, null, 'falta upload → null')

// ─── buildRichInputPayload · shape canon v1 completo ────────────────

const payload = buildRichInputPayload({
  imageAttachments: [{ id: 'i1', fileName: 'a.png', mimeType: 'image/png', size: 100 }],
  uploadedImageIds: ['up-1'],
  fileAttachments: [],
  uploadedDocumentIds: [],
})

assert.equal(payload.schema_version, ATLAS_RICH_INPUT_PAYLOAD_SCHEMA)
assert.equal(payload.schema_version, 'atlas.rich_input.payload.v1')
assert.deepEqual(payload.uploaded_image_ids, ['up-1'])
assert.deepEqual(payload.uploaded_document_ids, [])
assert.deepEqual(payload.text_blocks, [])
assert.deepEqual(payload.url_attachments, [])
assert.equal(payload.source_manifest.length, 1)
assert.equal(payload.source_manifest[0].id, 'i1')

// ─── buildRichInputPayload · URL attachments from text ───────────────

const urlPayload = buildRichInputPayload({
  imageAttachments: [],
  uploadedImageIds: [],
  fileAttachments: [],
  uploadedDocumentIds: [],
  inputText: 'veja https://youtu.be/dQw4w9WgXcQ e https://github.com/atlas/app',
})

assert.equal(urlPayload.url_attachments.length, 2)
assert.equal(urlPayload.url_attachments[0].kind, 'youtube')
assert.equal(urlPayload.url_attachments[0].ref_id, 'dQw4w9WgXcQ')
assert.equal(urlPayload.url_attachments[0].thumbnail_url, 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
assert.equal(urlPayload.url_attachments[1].kind, 'github')
assert.equal(urlPayload.url_attachments[1].ref_id, 'atlas/app')
assert.equal(urlPayload.source_manifest.length, 2)
assert.equal(urlPayload.source_manifest[0].kind, 'url')
assert.equal(urlPayload.source_manifest[0].mime_type, 'text/uri-list')
assert.equal(urlPayload.source_manifest[0].uploaded_id, null)

// ─── Empty payload ──────────────────────────────────────────────────

const emptyPayload = buildRichInputPayload({
  imageAttachments: [],
  uploadedImageIds: [],
  fileAttachments: [],
  uploadedDocumentIds: [],
})
assert.equal(emptyPayload.source_manifest.length, 0)
assert.equal(emptyPayload.schema_version, 'atlas.rich_input.payload.v1')

console.log('✓ source_manifest builder tests passaram')
