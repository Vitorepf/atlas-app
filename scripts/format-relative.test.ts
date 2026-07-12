import assert from 'node:assert'
import { formatRelative } from '../lib/formatRelative'

const now = new Date('2026-07-12T12:00:00Z').getTime()
const ago = (ms: number) => new Date(now - ms).toISOString()

assert.equal(formatRelative(null, now), 'agora')
assert.equal(formatRelative(undefined, now), 'agora')
assert.equal(formatRelative('not-a-date', now), 'not-a-date') // invalid → raw passthrough
assert.equal(formatRelative(ago(20_000), now), 'agora')       // rounds to 0 min
assert.equal(formatRelative(ago(30_000), now), '1 min')       // 30s rounds up to 1
assert.equal(formatRelative(ago(5 * 60_000), now), '5 min')
assert.equal(formatRelative(ago(59 * 60_000), now), '59 min')
assert.equal(formatRelative(ago(2 * 3_600_000), now), '2 h')
assert.equal(formatRelative(ago(23 * 3_600_000), now), '23 h')
assert.equal(formatRelative(ago(3 * 86_400_000), now), '3 d')

console.log('format relative tests passed')
