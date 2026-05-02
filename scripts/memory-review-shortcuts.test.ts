import assert from 'node:assert/strict'
import {
  memoryReviewShortcutActionFromKey,
  nextMemoryReviewItemId,
} from '../lib/memoryReviewShortcuts'

assert.equal(memoryReviewShortcutActionFromKey({ key: 'j' }), 'next_item')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'ArrowDown' }), 'next_item')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'k' }), 'previous_item')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'ArrowUp' }), 'previous_item')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'e' }), 'toggle_editor')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'Enter' }), 'toggle_editor')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'x' }), 'toggle_selection')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'a' }), 'select_all')
assert.equal(memoryReviewShortcutActionFromKey({ key: 'Escape' }), 'clear_focus')

assert.equal(memoryReviewShortcutActionFromKey({ key: 'j', targetTagName: 'textarea' }), null)
assert.equal(memoryReviewShortcutActionFromKey({ key: 'j', targetTagName: 'input' }), null)
assert.equal(memoryReviewShortcutActionFromKey({ key: 'j', targetRole: 'textbox' }), null)
assert.equal(memoryReviewShortcutActionFromKey({ key: 'j', isContentEditable: true }), null)
assert.equal(memoryReviewShortcutActionFromKey({ key: 'j', metaKey: true }), null)
assert.equal(memoryReviewShortcutActionFromKey({ key: 'j', defaultPrevented: true }), null)

assert.equal(nextMemoryReviewItemId(['a', 'b', 'c'], null, 'next'), 'a')
assert.equal(nextMemoryReviewItemId(['a', 'b', 'c'], null, 'previous'), 'c')
assert.equal(nextMemoryReviewItemId(['a', 'b', 'c'], 'a', 'next'), 'b')
assert.equal(nextMemoryReviewItemId(['a', 'b', 'c'], 'a', 'previous'), 'c')
assert.equal(nextMemoryReviewItemId(['a', 'b', 'c'], 'missing', 'next'), 'a')
assert.equal(nextMemoryReviewItemId([], 'a', 'next'), null)

console.log('memory review shortcut tests passed')
