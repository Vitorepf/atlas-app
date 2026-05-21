# Atlas Voice Mobile · auditoria de conclusão

Objetivo operacional: garantir o fluxo de Voice mobile ponta a ponta, reduzir rebuilds via OTA e chegar a um estado comparável ao desktop em previsibilidade de uso.

## Critérios de sucesso

| Critério | Evidência atual | Status |
| --- | --- | --- |
| LiveKit/WebRTC nativo disponível no build | `package.json`, `app.config.js`, `lib/livekitGlobals.ts`, `app/_layout.tsx` | Verificado localmente |
| WebRTC registrado antes do app montar | `app/_layout.tsx` importa `../lib/livekitGlobals` na primeira linha | Verificado localmente |
| Voice UI mostra estados humanos | `components/sheets/VoiceModeSheet.tsx` + `scripts/mobile-voice-ux-contract.test.ts` | Verificado localmente |
| Endpointing preserva pausas longas | `components/sheets/AtlasAiSheet.tsx` + `lib/atlasVoiceRuntime.ts` + `scripts/mobile-voice-runtime.test.ts` | Verificado localmente |
| Ajustes JS não exigem rebuild sempre | `expo-updates`, `eas.json` channel preview, `lib/mobileOtaUpdates.ts` | Verificado localmente |
| Build base iOS pronto | EAS build `52aa204c-4592-4d97-abdd-7c1e9531e001`, status `FINISHED`, runtime `1.0.0` | Verificado via EAS |
| OTA atual publicado | Update group `9f90e8b2-bb30-40f5-ac90-a4c1a11b71ad`, branch `preview`, runtime `1.0.0` | Verificado via EAS |
| Doctor cobre pré-condições | `npm run doctor:mobile-voice` | PASS 10/10 |
| Check completo cobre build JS/iOS | `npm run check:mobile-voice` | PASS |
| Fluxo real no iPhone funciona | Teste físico em `docs/mobile-voice-physical-test.md` | Pendente |

## Comandos verificados

```bash
npm run doctor:mobile-voice
npm run check:mobile-voice
npx eas-cli update:list --branch preview --limit 1 --json
npx eas-cli build:view 52aa204c-4592-4d97-abdd-7c1e9531e001 --json
```

## Bloqueio restante

Não é tecnicamente correto marcar o objetivo como concluído sem executar o teste físico no iPhone. O ambiente local atual não possui Xcode completo ativo (`xcode-select` aponta para CommandLineTools), então não há como instalar/rodar o app no aparelho a partir daqui.

Conclusão atual: pronto para teste físico, não certificado como concluído.
