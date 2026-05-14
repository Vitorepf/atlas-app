import * as FileSystem from 'expo-file-system/legacy'
import type { ComposerFileAttachment } from './attachmentTypes'
import { formatBytes } from './attachmentTypes'
import {
  MAX_DRAFT_FILE_BYTES,
  MAX_DRAFT_FILES,
  newAttachmentId,
} from './AtlasAiAttachmentModel'

export const LONG_MESSAGE_LIGHT_SUMMARY_CHARS = 8000
export const LONG_MESSAGE_ARTIFACT_CHARS = 40000
export const LONG_MESSAGE_CHUNK_CHARS = 6000
export const LONG_MESSAGE_TOP_CHUNKS = 5

export interface LongMessagePlan {
  shouldExternalize: boolean
  originalChars: number
  chunkCount: number
  summary: string[]
  priorityChunks: LongMessageChunk[]
}

export interface LongMessageChunk {
  index: number
  start: number
  end: number
  text: string
  preview: string
  score: number
}

export interface PreparedLongMessage {
  input: string
  fileAttachments: ComposerFileAttachment[]
  transformed: boolean
  metadata?: Record<string, unknown>
}

export async function prepareLongMessageForAtlas(
  input: string,
  fileAttachments: ComposerFileAttachment[],
): Promise<PreparedLongMessage> {
  const plan = buildLongMessagePlan(input)
  if (!plan.shouldExternalize) {
    return {
      input,
      fileAttachments,
      transformed: false,
    }
  }

  if (fileAttachments.length >= MAX_DRAFT_FILES) {
    throw new Error(`Mensagem muito grande. Remova 1 arquivo para eu anexar o texto completo como .md.`)
  }

  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) {
    throw new Error('Cache local indisponível para preparar mensagem longa.')
  }

  const fileName = longMessageFileName()
  const artifactBody = buildLongMessageArtifact(input, plan)
  const estimatedBytes = utf8Bytes(artifactBody)
  if (estimatedBytes > MAX_DRAFT_FILE_BYTES) {
    throw new Error(`Mensagem longa demais para upload (${formatBytes(estimatedBytes)}). Divida em partes menores.`)
  }

  const uri = `${cacheDir}${fileName}`
  await FileSystem.writeAsStringAsync(uri, artifactBody, {
    encoding: FileSystem.EncodingType.UTF8,
  })
  const info = await FileSystem.getInfoAsync(uri)
  const size = info.exists && typeof info.size === 'number' ? info.size : estimatedBytes
  const compactInput = buildLongMessageCompactPrompt(fileName, plan)

  return {
    input: compactInput,
    fileAttachments: [
      ...fileAttachments,
      {
        id: newAttachmentId(),
        uri,
        fileName,
        mimeType: 'text/markdown',
        size,
        source: 'long_message',
      },
    ],
    transformed: true,
    metadata: {
      schema: 'atlas.long_message.v1',
      original_chars: plan.originalChars,
      artifact_name: fileName,
      artifact_bytes: size,
      chunk_count: plan.chunkCount,
      compact_input_chars: compactInput.length,
      priority_chunk_indexes: plan.priorityChunks.map((chunk) => chunk.index),
    },
  }
}

export function buildLongMessagePlan(input: string): LongMessagePlan {
  const originalChars = input.length
  const chunks = chunkLongMessage(input, LONG_MESSAGE_CHUNK_CHARS)
  const scoredChunks = chunks.map(scoreChunk)
  const priorityChunks = scoredChunks
    .slice()
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, LONG_MESSAGE_TOP_CHUNKS)
    .sort((a, b) => a.index - b.index)

  return {
    shouldExternalize: originalChars > LONG_MESSAGE_ARTIFACT_CHARS,
    originalChars,
    chunkCount: chunks.length,
    summary: buildStructuralSummary(input, chunks),
    priorityChunks,
  }
}

export function chunkLongMessage(input: string, maxChars: number): LongMessageChunk[] {
  const blocks = input
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  const chunks: LongMessageChunk[] = []
  let current = ''
  let start = 0
  let cursor = 0

  const flush = () => {
    const text = current.trim()
    if (!text) return
    const end = start + text.length
    chunks.push({
      index: chunks.length + 1,
      start,
      end,
      text,
      preview: compactPreview(text, 420),
      score: 0,
    })
    current = ''
    start = cursor
  }

  for (const block of blocks.length > 0 ? blocks : [input.trim()].filter(Boolean)) {
    const next = current ? `${current}\n\n${block}` : block
    if (next.length > maxChars && current) {
      flush()
    }

    if (block.length > maxChars) {
      for (let offset = 0; offset < block.length; offset += maxChars) {
        const slice = block.slice(offset, offset + maxChars)
        current = slice
        start = cursor + offset
        flush()
      }
      cursor += block.length + 2
      start = cursor
      continue
    }

    if (!current) start = cursor
    current = current ? `${current}\n\n${block}` : block
    cursor += block.length + 2
  }

  flush()
  return chunks.length > 0 ? chunks : [{
    index: 1,
    start: 0,
    end: input.length,
    text: input,
    preview: compactPreview(input, 420),
    score: 0,
  }]
}

function buildLongMessageArtifact(input: string, plan: LongMessagePlan): string {
  const lines = [
    '---',
    'schema: atlas.long_message.v1',
    `created_at: ${new Date().toISOString()}`,
    `original_chars: ${plan.originalChars}`,
    `chunks: ${plan.chunkCount}`,
    '---',
    '',
    '# Mensagem longa enviada ao Atlas',
    '',
    '## Resumo estrutural',
    ...plan.summary.map((line) => `- ${line}`),
    '',
    '## Blocos prioritários',
    ...plan.priorityChunks.map((chunk) => `- bloco ${chunk.index}: caracteres ${chunk.start}-${chunk.end}; ${chunk.preview}`),
    '',
    '## Conteúdo original',
    '',
    input,
    '',
  ]

  return lines.join('\n')
}

function buildLongMessageCompactPrompt(fileName: string, plan: LongMessagePlan): string {
  const lines = [
    `[Mensagem longa preservada como anexo textual: ${fileName}]`,
    '',
    'O conteúdo completo está no anexo Markdown. Leia o anexo quando a resposta depender de detalhes, ordem, nomes, listas ou trechos exatos. Não responda apenas pelo resumo se o pedido exigir precisão.',
    '',
    'Resumo estrutural:',
    ...plan.summary.map((line) => `- ${line}`),
    '',
    'Trechos prioritários para orientação inicial:',
  ]

  for (const chunk of plan.priorityChunks) {
    lines.push(`- bloco ${chunk.index} (${chunk.start}-${chunk.end}): ${chunk.preview}`)
  }

  lines.push('', 'Pedido: responda considerando o conteúdo completo do anexo.')
  return lines.join('\n')
}

function buildStructuralSummary(input: string, chunks: LongMessageChunk[]): string[] {
  const normalized = input.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  const headingLines = lines.filter((line) => /^#{1,4}\s+/.test(line) || /^[A-ZÀ-Ý0-9][^.!?]{2,80}:$/.test(line)).slice(0, 8)
  const questionCount = (normalized.match(/\?/g) ?? []).length
  const bulletCount = lines.filter((line) => /^[-*•]|\d+[.)]\s+/.test(line)).length
  const codeFenceCount = (normalized.match(/```/g) ?? []).length
  const firstLine = compactPreview(lines[0] ?? '', 160)

  const summary = [
    `${input.length.toLocaleString('pt-BR')} caracteres preservados integralmente em ${chunks.length} bloco(s).`,
    `${questionCount} pergunta(s), ${bulletCount} item(ns) de lista e ${Math.floor(codeFenceCount / 2)} bloco(s) de código detectados.`,
  ]

  if (firstLine) {
    summary.push(`abertura: ${firstLine}`)
  }

  if (headingLines.length > 0) {
    summary.push(`tópicos detectados: ${headingLines.map((line) => line.replace(/^#+\s+/, '')).join(' | ')}`)
  }

  return summary
}

function scoreChunk(chunk: LongMessageChunk): LongMessageChunk {
  const text = chunk.text.toLowerCase()
  let score = chunk.index === 1 ? 40 : 0
  score += Math.min(30, (chunk.text.match(/\?/g) ?? []).length * 8)
  score += /\b(importante|preciso|problema|erro|falha|corrig|implementar|decisão|decisao|objetivo|requisito|pergunta)\b/.test(text) ? 24 : 0
  score += /^#{1,4}\s+/m.test(chunk.text) ? 16 : 0
  score += /```/.test(chunk.text) ? 12 : 0
  score += Math.min(12, Math.round(chunk.text.length / 1000))
  return { ...chunk, score }
}

function compactPreview(value: string, maxChars: number): string {
  const compacted = value.replace(/\s+/g, ' ').trim()
  if (compacted.length <= maxChars) return compacted
  return `${compacted.slice(0, Math.max(0, maxChars - 1)).trim()}…`
}

function longMessageFileName(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')

  return `atlas-long-message-${stamp}-${Math.random().toString(36).slice(2, 6)}.md`
}

function utf8Bytes(value: string): number {
  let bytes = 0
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x7f) {
      bytes += 1
    } else if (code <= 0x7ff) {
      bytes += 2
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      bytes += 4
      index += 1
    } else {
      bytes += 3
    }
  }

  return bytes
}
