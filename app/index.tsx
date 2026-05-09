import { AtlasAiSheet } from '../components/sheets/AtlasAiSheet'

// =============================================================================
// v18 · Atlas AI vira tela primária do app (rota `/`)
// =============================================================================
//
// Decisão arquitetural (8 mai 2026):
//
// Antes: rota `/` carregava o exemplar editorial diário (masthead ATLAS +
// agenda + operação + tecido + portas) e Atlas AI era um sheet overlay
// acessado via ✦ central do dock.
//
// Agora: Atlas AI vira a "home" navegacional — quando user abre o app,
// vai direto pra ela. O exemplar editorial migrou pra `/edicao` (vocabulário
// canon Atlas: a tela inteira É uma edição matinal do jornal pessoal,
// identificada por folio vol·no · "EDIÇÃO MATINAL" já era o dateline visível
// na tela, formaliza-se o vocabulário que estava lá).
//
// Onda 1 (legado): hack temporário · esta tela auto-abria o AtlasAiSheet via
// overlay quando ganhava foco. Funcional mas tecnicamente esquisito (overlay
// como rota).
//
// Onda 4 (atual): refator real · esta tela renderiza AtlasAiSheet em
// `presentationMode="screen"` direto, sem overlay. AtlasAiSheet detecta o
// modo e usa `<View flex 1>` + safe-area inset em vez de `<SideSheet>`
// (que tem position absolute + slide animation). "← Voltar" do header
// navega pra /edicao em vez de close().
//
// Comportamento dual mode preservado:
//   · presentationMode="screen" (rota `/`) — tela primária fullscreen
//   · presentationMode="sheet" (default · overlay via openAtlasAi) —
//     usado quando ✦ central do dock é tocado em outras rotas (/inbox,
//     /review, /ritual). Push notifications também usam esse modo.
// =============================================================================

export default function HomeScreen() {
  return <AtlasAiSheet presentationMode="screen" />
}
