import assert from 'node:assert/strict'
import {
  deriveCardState,
  placeholderTextFor,
  placeholderTypographyFor,
  resolveLongPressMicAction,
} from '../components/sheets/atlas-ai/AtlasComposerCardModel'

// ─── deriveCardState · hasText ───────────────────────────────────────

assert.equal(deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false }).hasText, false)
assert.equal(deriveCardState({ value: '   ', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false }).hasText, false, 'whitespace trim')
assert.equal(deriveCardState({ value: 'hello', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false }).hasText, true)

// ─── canSubmit · text only ──────────────────────────────────────────

assert.equal(
  deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false }).canSubmit,
  false, 'empty + no fallback = no submit',
)
assert.equal(
  deriveCardState({ value: 'hi', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false }).canSubmit,
  true, 'has text = can submit',
)

// ─── canSubmit · fallback (attachments) ─────────────────────────────

assert.equal(
  deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: true, isFocused: false }).canSubmit,
  true, 'empty + canSubmitWithoutText = can submit',
)

// ─── canSubmit · disabled blocks ────────────────────────────────────

assert.equal(
  deriveCardState({ value: 'hi', disabled: true, recording: false, canSubmitWithoutText: false, isFocused: false }).canSubmit,
  false, 'disabled blocks',
)

// ─── canSubmit · recording blocks ───────────────────────────────────

assert.equal(
  deriveCardState({ value: 'hi', disabled: false, recording: true, canSubmitWithoutText: false, isFocused: false }).canSubmit,
  false, 'recording blocks',
)

// ─── showCursor · focused + empty ───────────────────────────────────

assert.equal(
  deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: true }).showCursor,
  true, 'focused empty = cursor on',
)
assert.equal(
  deriveCardState({ value: 'hi', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: true }).showCursor,
  false, 'focused with text = cursor off',
)
assert.equal(
  deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false }).showCursor,
  false, 'not focused = cursor off',
)
assert.equal(
  deriveCardState({ value: '', disabled: true, recording: false, canSubmitWithoutText: false, isFocused: true }).showCursor,
  false, 'disabled = cursor off mesmo focused empty',
)

// ─── showSendInRightSlot vs showMicInRightSlot · mutex ──────────────

const idleEmpty = deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false })
assert.equal(idleEmpty.showSendInRightSlot, false)
assert.equal(idleEmpty.showMicInRightSlot, true, 'empty = mic visible')

const withText = deriveCardState({ value: 'pergunta', disabled: false, recording: false, canSubmitWithoutText: false, isFocused: false })
assert.equal(withText.showSendInRightSlot, true, 'text = send visible')
assert.equal(withText.showMicInRightSlot, false)

const withAttachments = deriveCardState({ value: '', disabled: false, recording: false, canSubmitWithoutText: true, isFocused: false })
assert.equal(withAttachments.showSendInRightSlot, true, 'attachments = send visible')
assert.equal(withAttachments.showMicInRightSlot, false)

const recordingState = deriveCardState({ value: 'pergunta', disabled: false, recording: true, canSubmitWithoutText: false, isFocused: false })
assert.equal(recordingState.showSendInRightSlot, false, 'recording = no send mesmo com texto')
assert.equal(recordingState.showMicInRightSlot, true, 'mic visível durante recording')

// ─── placeholderTypographyFor ───────────────────────────────────────

const emptyTypo = placeholderTypographyFor(false)
assert.equal(emptyTypo.fontFamilyKey, 'serifItalic', 'empty = Frau italic canon')
assert.equal(emptyTypo.fontSize, 20)
assert.equal(emptyTypo.lineHeight, 28)

const typedTypo = placeholderTypographyFor(true)
assert.equal(typedTypo.fontFamilyKey, 'sans', 'typed = Inter sans canon')
assert.equal(typedTypo.fontSize, 16)
assert.equal(typedTypo.lineHeight, 24)

// ─── placeholderTextFor ─────────────────────────────────────────────

assert.equal(placeholderTextFor(), 'Escreva ao Atlas')
assert.equal(placeholderTextFor(null), 'Escreva ao Atlas')
assert.equal(placeholderTextFor(''), 'Escreva ao Atlas')
assert.equal(placeholderTextFor('   '), 'Escreva ao Atlas', 'whitespace fallback canon')
assert.equal(placeholderTextFor('Continue com Atlas'), 'Continue com Atlas')

// ─── resolveLongPressMicAction · canon voice flow ──────────────────

assert.equal(
  resolveLongPressMicAction({ value: '', attachmentCount: 0, disabled: false, recording: false }),
  'voice_mode', 'empty + sem anexos = voice mode fullscreen',
)
assert.equal(
  resolveLongPressMicAction({ value: 'hi', attachmentCount: 0, disabled: false, recording: false }),
  'start_recording', 'com texto = start recording inline',
)
assert.equal(
  resolveLongPressMicAction({ value: '', attachmentCount: 2, disabled: false, recording: false }),
  'start_recording', 'com anexos = start recording inline',
)
assert.equal(
  resolveLongPressMicAction({ value: '   ', attachmentCount: 0, disabled: false, recording: false }),
  'voice_mode', 'whitespace = voice mode (trim)',
)
assert.equal(
  resolveLongPressMicAction({ value: 'hi', attachmentCount: 0, disabled: true, recording: false }),
  'noop', 'disabled = noop',
)
assert.equal(
  resolveLongPressMicAction({ value: 'hi', attachmentCount: 0, disabled: false, recording: true }),
  'noop', 'recording = noop (já gravando)',
)

console.log('✓ AtlasComposerCard model tests passaram')
