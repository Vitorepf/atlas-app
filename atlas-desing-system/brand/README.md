# Atlas — Brand Pack

Tudo o que o Claude (ou qualquer designer/dev) precisa para usar a marca corretamente.

## Arquivos

| arquivo | uso |
|---|---|
| `atlas-logo.svg` | marca primária — bronze sobre transparente. Default em quase tudo. |
| `atlas-logo-ink.svg` | tinta sobre transparente. Uso formal (faturas, contratos, documentos legais). |
| `atlas-logo-marfim.svg` | marfim sobre transparente. Para fundos escuros (modo noite, hero de marketing sobre prussiano). |
| `atlas-app-icon.svg` | 1024×1024 com background marfim e raio iOS squircle. Pronto para gerar PNGs do AppIcon.appiconset. |

## Paleta

| token | hex | uso |
|---|---|---|
| Bronze | `#9B7A3F` | marca primária, divisores, accents |
| Bronze Deep | `#7A5E2F` | pin central, hover, segundo plano |
| Marfim | `#F4EFE6` | background do app, fundo do app icon |
| Surface | `#EAE3D6` | cards |
| Premium | `#E0D8C9` | superfícies elevadas |
| Pergaminho | `#ECE3D2` | papelaria |
| Ink | `#1A1612` | tipografia escura |
| Ink-2 | `#6B6358` | tipografia secundária |
| Prussiano | `#1B3A57` | acento frio (BlackInk domain) |

## Tipografia

| família | peso | uso |
|---|---|---|
| Cinzel | 600 | wordmark "ATLAS" (tracking 0.32em, uppercase) |
| IM Fell English Italic | 400 | tagline "qui caelum sustinet" |
| Fraunces | 400/500 | títulos editoriais no app |
| Cormorant Garamond Italic | 400 | citações em empty states |
| Inter | 400/500/600 | UI |
| JetBrains Mono | 400/500 | numerais, timestamps, specs |

## Regras

**Faça:**
- Use bronze sobre marfim como default.
- Tamanho mínimo 16px (com peso bold automático abaixo de 32px).
- Respeite clear-space: 1× a largura de um braço cardinal em volta.
- Para AppIcon iOS, gere PNGs nas resoluções padrão (20pt, 29pt, 40pt, 60pt, 76pt, 83.5pt, 1024px) a partir do SVG mestre.

**Não faça:**
- Nunca rotacione a marca.
- Nunca aplique gradiente ou sombra externa.
- Nunca use cores fora da paleta.
- Nunca componha o glifo ✦ sozinho como logo (ele é só acento decorativo no app).
- Nunca abaixo de 16px.

## Construção (caso precise reconstruir)

ViewBox 200×200, centro em (100,100).
- Anel externo: r=64, stroke 1.2
- Anel interno: r=56, stroke 0.7 com opacity 0.6
- 4 braços cardinais: 30pt cada, stroke 1.6, linecap round
- Estrela 4 pontas: r=30, ponta interna em 16% (slim)
- Pin central: r=1.5 em bronze deep

## Lockup com wordmark

```
[mark 64px] | ATLAS
              — qui caelum sustinet —
```

Divisor vertical 1px em `#D4CCBC`, gap 28px entre mark e wordmark, tracking 0.32em na wordmark.
