# Atlas App - Ambiente de Desenvolvimento iOS

Este e o fluxo oficial para testar rapido no iPhone sem usar Expo Go.

## Decisao

O Atlas deve ser testado em **Expo Development Build no iPhone fisico**.

Motivo: Expo Go nao carrega os modulos nativos reais do Atlas, como HealthKit, audio nativo e background modes. Expo Go serve para prototipo simples, nao para o Atlas real.

## Fluxos

### 1. Desenvolvimento diario

Use quando eu alterar JS/TS/layout/design/sync sem mudar dependencia nativa.

```bash
npm run dev:ios
```

No iPhone:

1. Abra o app Atlas Development Build.
2. Entre no servidor de desenvolvimento que apareceu.
3. Teste a mudanca.

Quando cache ou Metro ficarem inconsistentes:

```bash
npm run dev:ios:clear
```

Se a porta 8082 ficou presa:

```bash
npm run dev:ios:restart
```

### 2. Desenvolvimento fora da mesma rede

Use quando o iPhone nao estiver na mesma rede do Mac.

```bash
npm run dev:ios:tunnel
```

Esse modo e mais lento, mas ajuda quando LAN nao resolve.

### 3. Build nativo de desenvolvimento

Use quando mudar dependencia nativa, config plugin, entitlements ou HealthKit.

```bash
npm run build:ios:dev
```

Instale o build no iPhone pelo link/QR do EAS.

### 4. Preview sem Metro

Use quando quiser um app instalavel que abre sozinho, sem depender do Metro.

```bash
npm run build:ios:preview
```

## Regra pratica

- Mudou tela, layout, estado, API client ou logica JS: `npm run dev:ios`.
- Deu bug estranho de cache: `npm run dev:ios:clear`.
- Porta travou: `npm run dev:ios:restart`.
- Instalou dependencia nativa ou mudou `app.config.js`: `npm run build:ios:dev`.
- Precisa usar fora de casa sem Mac/Metro: `npm run build:ios:preview`.

## Backend

O backend Laravel precisa estar rodando no Mac e acessivel pelo host configurado no app:

```text
vitors-macbook-pro-1:3737
```

Para usar fora de casa, mantenha Tailscale ativo no Mac e no iPhone. O app deve falar com o Mac via MagicDNS/Tailscale.

## Sensor 4

O rastreamento nativo de Screen Time / Family Controls esta pausado no app. Ele depende de entitlements especiais da Apple e estava bloqueando o build EAS.

O Sensor 4 segue ativo pelo caminho que nao depende da Apple: Rize API no backend. O app mantem os tipos, buckets e contrato de dados para retomar o caminho nativo no futuro sem refazer o schema.
