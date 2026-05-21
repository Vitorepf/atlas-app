import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const voiceSheet = fs.readFileSync(path.join(root, 'components/sheets/VoiceModeSheet.tsx'), 'utf8')
const atlasAiSheet = fs.readFileSync(path.join(root, 'components/sheets/AtlasAiSheet.tsx'), 'utf8')
const runtime = fs.readFileSync(path.join(root, 'lib/atlasVoiceRuntime.ts'), 'utf8')
const appConfig = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8')
const easConfig = fs.readFileSync(path.join(root, 'eas.json'), 'utf8')
const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8')
const mobileOtaUpdates = fs.readFileSync(path.join(root, 'lib/mobileOtaUpdates.ts'), 'utf8')

for (const phrase of [
  'Pode falar. Estou ouvindo.',
  'Fala enviada. Estou transcrevendo.',
  'Pedido recebido. Estou pensando.',
  'Estou respondendo em voz.',
  'Sua fala já saiu do microfone. Agora estou entendendo o texto.',
  'O Atlas recebeu o pedido e está preparando a resposta.',
]) {
  assert.ok(voiceSheet.includes(phrase), `VoiceModeSheet precisa expor o estado humano: ${phrase}`)
}

assert.ok(
  atlasAiSheet.includes('const MOBILE_VOICE_SPEECH_THRESHOLD_DB = -38'),
  'Voice realtime mobile não pode usar threshold -50 dB; isso prende o fim de fala com ruído ambiente.',
)
assert.ok(
  atlasAiSheet.includes('const MOBILE_VOICE_MAX_TURN_AFTER_SPEECH_MS = 120_000'),
  'Voice realtime mobile precisa de limite de segurança por turno com fala real.',
)
assert.ok(
  runtime.includes('maxTurnAfterSpeechMs?: number'),
  'Endpointing precisa aceitar limite explícito depois de detectar fala.',
)
assert.ok(
  runtime.includes("reason: 'quality_turn_limit_reached'"),
  'Endpointing precisa finalizar turno longo mesmo se o microfone continuar vendo ruído como fala.',
)

assert.ok(
  appConfig.includes("url: 'https://u.expo.dev/9fd23e13-65fd-4775-a72d-7b6ab9108769'"),
  'App precisa de EAS Update para evitar rebuild iOS em ajustes JS.',
)
assert.ok(
  appConfig.includes("policy: 'appVersion'"),
  'App precisa de runtimeVersion estável para EAS Update.',
)
assert.ok(
  layout.includes('useMobileOtaUpdates()'),
  'App precisa checar OTA no boot para reduzir rebuild iOS em ajustes JS.',
)
assert.ok(
  mobileOtaUpdates.includes('Updates.checkForUpdateAsync()')
    && mobileOtaUpdates.includes('Updates.fetchUpdateAsync()')
    && mobileOtaUpdates.includes('Updates.reloadAsync()'),
  'OTA boot hook precisa baixar e aplicar update disponível.',
)

const eas = JSON.parse(easConfig) as {
  build?: Record<string, { channel?: string }>
}
assert.equal(eas.build?.preview?.channel, 'preview', 'Build preview precisa apontar para channel preview.')
assert.equal(eas.build?.development?.channel, 'development', 'Build development precisa apontar para channel development.')
assert.equal(eas.build?.production?.channel, 'production', 'Build production precisa apontar para channel production.')

console.log('mobile voice ux contract tests passed')
