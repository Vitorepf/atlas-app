#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

const checks = []

function check(name, ok, detail, fix = null) {
  checks.push({ name, ok, detail, fix })
}

const pkg = readJson('package.json')
const eas = readJson('eas.json')
const appConfig = read('app.config.js')
const voiceSheet = read('components/sheets/VoiceModeSheet.tsx')
const atlasAiSheet = read('components/sheets/AtlasAiSheet.tsx')
const runtime = read('lib/atlasVoiceRuntime.ts')
const layout = read('app/_layout.tsx')
const livekitGlobals = read('lib/livekitGlobals.ts')
const mobileOtaUpdates = read('lib/mobileOtaUpdates.ts')
const physicalTestDoc = read('docs/mobile-voice-physical-test.md')
const completionAuditDoc = read('docs/mobile-voice-completion-audit.md')

check(
  'LiveKit nativo',
  Boolean(pkg.dependencies?.['@livekit/react-native'] && pkg.dependencies?.['@livekit/react-native-webrtc']),
  'Pacotes LiveKit/WebRTC instalados.',
  'Rode: npx expo install @livekit/react-native @livekit/react-native-webrtc',
)

check(
  'WebRTC registrado no boot',
  appConfig.includes("'@livekit/react-native-expo-plugin'")
    && layout.startsWith("import '../lib/livekitGlobals'")
    && livekitGlobals.includes('ensureLiveKitGlobals()')
    && livekitGlobals.includes('hasLiveKitWebRtcGlobals()')
    && voiceSheet.includes('ensureLiveKitGlobals()')
    && voiceSheet.includes('hasLiveKitWebRtcGlobals()'),
  'WebRTC é registrado antes do React montar e validado antes do LiveKit conectar.',
  'Garanta import de ../lib/livekitGlobals na primeira linha de app/_layout.tsx e validação em VoiceModeSheet.tsx.',
)

check(
  'Expo Updates',
  Boolean(
    pkg.dependencies?.['expo-updates']
      && appConfig.includes('https://u.expo.dev/9fd23e13-65fd-4775-a72d-7b6ab9108769')
      && layout.includes('useMobileOtaUpdates()')
      && mobileOtaUpdates.includes('Updates.checkForUpdateAsync()')
      && mobileOtaUpdates.includes('Updates.fetchUpdateAsync()')
      && mobileOtaUpdates.includes('Updates.reloadAsync()')
  ),
  'OTA configurado e checado automaticamente no boot do app.',
  'Rode: npx expo install expo-updates && npx eas-cli update:configure',
)

check(
  'Runtime version',
  appConfig.includes("policy: 'appVersion'"),
  'runtimeVersion usa appVersion, compatível com branch preview atual.',
  'Configure runtimeVersion em app.config.js.',
)

check(
  'Channel preview',
  eas.build?.preview?.channel === 'preview',
  'Build preview aponta para channel preview.',
  'Adicione "channel": "preview" no profile preview do eas.json.',
)

check(
  'Feedback de estados',
  [
    'Pode falar. Estou ouvindo.',
    'Fala enviada. Estou transcrevendo.',
    'Pedido recebido. Estou pensando.',
    'Estou respondendo em voz.',
    'Sua fala já saiu do microfone. Agora estou entendendo o texto.',
    'O Atlas recebeu o pedido e está preparando a resposta.',
    'A resposta está saindo em voz. Depois volto a escutar.',
  ].every((phrase) => voiceSheet.includes(phrase)),
  'Tela diferencia ouvindo/transcrevendo/pensando/respondendo.',
  'Revise components/sheets/VoiceModeSheet.tsx.',
)

check(
  'Endpointing anti-travamento',
  atlasAiSheet.includes('MOBILE_VOICE_SPEECH_THRESHOLD_DB = -38')
    && atlasAiSheet.includes('MOBILE_VOICE_MAX_TURN_AFTER_SPEECH_MS = 120_000')
    && runtime.includes("quality_turn_limit_reached"),
  'Detector de fim de fala evita ruído infinito e preserva pausas longas.',
  'Revise lib/atlasVoiceRuntime.ts e components/sheets/AtlasAiSheet.tsx.',
)

const tests = run('npm', ['run', 'test:atlas-ai'])
check(
  'Testes Atlas AI + Voice',
  tests.ok,
  tests.ok ? 'test:atlas-ai verde.' : `${tests.stderr || tests.stdout}`.slice(0, 500),
  'Rode npm run test:atlas-ai e corrija a primeira falha.',
)

const bundle = run('npx', ['expo', 'export:embed', '--eager', '--platform', 'ios', '--dev', 'false'])
check(
  'Bundle iOS',
  bundle.ok,
  bundle.ok ? 'Bundle iOS gerado com sucesso.' : `${bundle.stderr || bundle.stdout}`.slice(0, 500),
  'Rode npx expo export:embed --eager --platform ios --dev false.',
)

check(
  'Runbook de teste físico',
  physicalTestDoc.includes('Teste de fluxo') && physicalTestDoc.includes('52aa204c-4592-4d97-abdd-7c1e9531e001'),
  'Documento de validação física no iPhone existe e aponta para o build preview correto.',
  'Revise docs/mobile-voice-physical-test.md.',
)

check(
  'Auditoria de conclusão',
  completionAuditDoc.includes('Fluxo real no iPhone funciona')
    && completionAuditDoc.includes('Pendente')
    && completionAuditDoc.includes('não certificado como concluído'),
  'Auditoria separa evidência local de teste físico pendente.',
  'Revise docs/mobile-voice-completion-audit.md.',
)

const pass = checks.filter((item) => item.ok).length
const fail = checks.length - pass

console.log(`Atlas Mobile Voice Doctor · ${fail === 0 ? 'PASS' : 'FAIL'}`)
console.log(`${pass}/${checks.length} checks verdes`)
console.log('')

for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✗'} ${item.name}`)
  console.log(`  ${item.detail}`)
  if (!item.ok && item.fix) console.log(`  Próximo passo: ${item.fix}`)
}

if (fail > 0) process.exit(1)
