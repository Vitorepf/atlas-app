# Atlas Voice Mobile · teste físico

Objetivo: provar no iPhone que o Voice mobile abre, escuta, envia, recebe resposta e volta a escutar sem rebuild.

## 1. Base instalada

O iPhone precisa estar com um build `preview` que tenha `expo-updates`, LiveKit/WebRTC nativo e runtime `1.0.0`.

Build base validado:

- EAS build: `52aa204c-4592-4d97-abdd-7c1e9531e001`
- Profile: `preview`
- Channel: `preview`
- Runtime: `1.0.0`
- Status esperado: `FINISHED`

Comando para abrir o build:

```bash
cd /Users/vitorepf/develop/Atlas/atlas-app
npx eas-cli build:view 52aa204c-4592-4d97-abdd-7c1e9531e001
```

## 2. OTA atual

Update atual validado:

- Branch: `preview`
- Runtime: `1.0.0`
- Update group: `9f90e8b2-bb30-40f5-ac90-a4c1a11b71ad`
- Mensagem: `atlas mobile voice ota boot check`

Comando para confirmar:

```bash
cd /Users/vitorepf/develop/Atlas/atlas-app
npx eas-cli update:list --branch preview --limit 1
```

## 3. Antes de testar no iPhone

Rode:

```bash
cd /Users/vitorepf/develop/Atlas/atlas-app
npm run doctor:mobile-voice
npm run check:mobile-voice
```

Ambos precisam passar antes do teste físico.

## 4. Aplicar OTA no iPhone

1. Feche o Atlas totalmente no iPhone.
2. Abra o Atlas.
3. Se o app recarregar sozinho uma vez, aguarde.
4. Abra Atlas AI.
5. Toque no botão de Voice Realtime.

Se a tela ainda mostrar texto antigo como `Envio automático após pausa`, o iPhone não aplicou o OTA ou não está no build base `preview`.

## 5. Teste de fluxo

Execute uma conversa de 4 turnos:

1. Diga: `Atlas, você está me ouvindo? Responda em voz.`
2. Espere resposta em voz.
3. Sem fechar a tela, diga: `Agora me diga se você continua escutando depois de responder.`
4. Espere resposta em voz.
5. Diga uma frase longa com pausa no meio: `Preciso que você espere eu terminar de falar... pausa... porque às vezes eu penso enquanto falo.`
6. Confirme que ele não envia cedo demais.
7. Diga: `Encerra esse teste.`
8. Toque em `ENCERRAR`.

## 6. Evidência mínima

Marque:

- Abriu sem erro `WebRTC`.
- Não apareceu `registerGlobals`.
- Mostrou estados claros: ouvindo, transcrevendo, pensando, respondendo.
- Respondeu por voz.
- Voltou a escutar depois de responder.
- Não criou conversa nova a cada turno.
- Não enviou a fala no meio de uma pausa normal.
- Encerramento funcionou.

Se algum item falhar, registre a frase falada e o estado que ficou preso.

## 7. Resultado do teste

Preencha depois do teste físico:

```text
Data/hora:
Build instalado:
OTA aplicado:

Abriu sem erro WebRTC? sim/nao
Mostrou estados claros? sim/nao
Respondeu por voz no turno 1? sim/nao
Voltou a escutar no turno 2? sim/nao
Aguardou pausa longa sem cortar fala? sim/nao
Nao criou conversa nova indevida? sim/nao
Encerrar funcionou? sim/nao

Se falhou:
Estado visível na tela:
Frase falada:
Resposta recebida:
O que ficou preso:
Print anexado:
```
