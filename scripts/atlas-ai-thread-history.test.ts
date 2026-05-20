import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { threadHistoryModeOptions } from '../components/sheets/atlas-ai/threadHistoryModel'
import type { AtlasAiThread } from '../lib/api/client'

function thread(id: string, mode: string): AtlasAiThread {
  return {
    id,
    title: `Thread ${id}`,
    summary: null,
    status: 'active',
    surface: 'atlas_mobile_ai',
    workspace: 'Atlas',
    source_type: 'app',
    source_id: null,
    last_trace_id: null,
    last_provider: 'claude_cli',
    message_count: 2,
    last_message_at: '2026-05-19T01:08:05.000000Z',
    metadata: {
      current_mode: mode,
      atlas_mode: mode,
    },
    created_at: '2026-05-19T01:07:29.000000Z',
    updated_at: '2026-05-19T01:08:05.978064Z',
  }
}

{
  const options = threadHistoryModeOptions([
    thread('research-1', 'research'),
    thread('finance-1', 'finance'),
    thread('programming-1', 'programming'),
  ])

  assert.equal(options.find((option) => option.key === 'all')?.count, 3)
  assert.equal(options.find((option) => option.key === 'research')?.count, 1)
  assert.equal(options.find((option) => option.key === 'finance')?.count, 1)
  assert.equal(options.find((option) => option.key === 'programming')?.count, 1)
  assert.ok(options.some((option) => option.label === 'Pesquisa'))
  assert.ok(options.some((option) => option.label === 'Finanças'))
}

{
  const sheet = readFileSync(resolve(__dirname, '../components/sheets/AtlasAiSheet.tsx'), 'utf8')

  assert.match(sheet, /const threadListEnabled = visible && \(threadHistoryOpen \|\| atlasWarmupReady\)/)
  assert.doesNotMatch(sheet, /const threadListEnabled = visible && !requestedThreadId/)
  assert.match(sheet, /queryFn: \(\) => listAiThreads\(\{ status: 'active', limit: pageLimit, light: true \}\)/)
}

console.info('atlas ai thread history tests passed')
