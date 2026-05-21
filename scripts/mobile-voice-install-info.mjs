#!/usr/bin/env node

const buildId = '52aa204c-4592-4d97-abdd-7c1e9531e001'
const updateGroup = '9f90e8b2-bb30-40f5-ac90-a4c1a11b71ad'

console.log('Atlas Voice Mobile · teste no iPhone')
console.log('')
console.log('1. Build base preview')
console.log(`   npx eas-cli build:view ${buildId}`)
console.log('')
console.log('2. OTA preview esperado')
console.log(`   update group: ${updateGroup}`)
console.log('   npx eas-cli update:list --branch preview --limit 1')
console.log('')
console.log('3. Antes do teste')
console.log('   npm run doctor:mobile-voice')
console.log('   npm run check:mobile-voice')
console.log('')
console.log('4. No iPhone')
console.log('   Feche o Atlas totalmente.')
console.log('   Abra de novo e espere uma possível recarga automática.')
console.log('   Abra Atlas AI e toque no Voice Realtime.')
console.log('')
console.log('5. Runbook completo')
console.log('   docs/mobile-voice-physical-test.md')
