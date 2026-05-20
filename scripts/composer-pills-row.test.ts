/**
 * Slice 3c · token estimator + helpers do ComposerPillsRow.
 *
 * Não testa renderização (RN runtime), testa as funções puras:
 *   - estimateComposerTokens (text + img + file → tokens proxy)
 *   - labelForMode (mode → label pt-BR)
 *   - labelForProvider (provider → label canon)
 */
import assert from 'node:assert/strict'
import {
  estimateComposerTokens,
  labelForMode,
  labelForProvider,
} from '../components/sheets/atlas-ai/ComposerPillsRowModel'
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from '../components/sheets/atlas-ai/attachmentTypes'

function makeImg(id: string): ComposerImageAttachment {
  return {
    id,
    uri: 'file:///fake',
    fileName: 'a.png',
    mimeType: 'image/png',
    size: 100_000,
    width: 800,
    height: 600,
    source: 'photos',
  }
}

function makeFile(id: string): ComposerFileAttachment {
  return {
    id,
    uri: 'file:///fake',
    fileName: 'a.pdf',
    mimeType: 'application/pdf',
    size: 1_000_000,
    source: 'files',
  }
}

// ─── Text only ───────────────────────────────────────────────────────

assert.equal(estimateComposerTokens('', [], []), 0)
assert.equal(estimateComposerTokens('   ', [], []), 0, 'whitespace = 0')

const short = estimateComposerTokens('hello world', [], [])
assert.ok(short >= 1 && short <= 5, '~3 tokens para 11 chars')

const text100 = 'a'.repeat(100)
assert.equal(estimateComposerTokens(text100, [], []), 25, '100 chars = 25 tokens')

const text400 = 'a'.repeat(400)
assert.equal(estimateComposerTokens(text400, [], []), 100)

// ─── Imagens · 1200 tokens cada ──────────────────────────────────────

assert.equal(estimateComposerTokens('', [makeImg('1')], []), 1200)
assert.equal(estimateComposerTokens('', [makeImg('1'), makeImg('2')], []), 2400)
assert.equal(estimateComposerTokens('', [makeImg('1'), makeImg('2'), makeImg('3')], []), 3600)

// ─── Files · 600 tokens cada (fallback PDF) ──────────────────────────

assert.equal(estimateComposerTokens('', [], [makeFile('1')]), 600)
assert.equal(estimateComposerTokens('', [], [makeFile('1'), makeFile('2')]), 1200)

// ─── Combo · text + imagens + files ──────────────────────────────────

const combo = estimateComposerTokens(
  'pergunta sobre os anexos',
  [makeImg('1')],
  [makeFile('1'), makeFile('2')],
)
// "pergunta sobre os anexos" = 24 chars → round(24/4) = 6
// 1 img = 1200
// 2 files = 1200
// total = 2406
assert.equal(combo, 6 + 1200 + 1200)

// ─── Realistic conversation case ─────────────────────────────────────

const realistic = estimateComposerTokens(
  'Por favor analise esses documentos e me diga as 3 conclusões principais.',
  [makeImg('1')],
  [makeFile('1')],
)
// 72 chars → 18 tokens (round)
// 1 img + 1 file = 1800
// total = 1818
assert.ok(realistic >= 1815 && realistic <= 1825, `realistic ≈ 1818 (got ${realistic})`)

// ─── labelForMode · 12 modos canon + fallback ───────────────────────

assert.equal(labelForMode('auto'), 'auto')
assert.equal(labelForMode('programming'), 'programação')
assert.equal(labelForMode('finance'), 'finanças')
assert.equal(labelForMode('personal_development'), 'pessoal')
assert.equal(labelForMode('cyber'), 'cyber')
assert.equal(labelForMode('automation'), 'automação')
assert.equal(labelForMode('unknown_mode'), 'unknown_mode', 'fallback retorna o próprio key')

// ─── labelForProvider · 5 providers canon + fallback ────────────────

assert.equal(labelForProvider('auto'), 'auto')
assert.equal(labelForProvider('claude_cli'), 'claude')
assert.equal(labelForProvider('codex_cli'), 'codex')
assert.equal(labelForProvider('gemini_cli'), 'gemini')
assert.equal(labelForProvider('claude_codex'), 'conselho')
assert.equal(labelForProvider('unknown_provider'), 'unknown_provider')

console.log('✓ composer pills row tests passaram')
