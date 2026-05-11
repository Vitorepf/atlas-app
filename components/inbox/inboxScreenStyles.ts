import { StyleSheet } from 'react-native'
import { fonts } from '../../design/tokens'

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Floating capture · v8 thumb-zone · ancorado ao bottom-right do dispositivo.
  // v13 · centralizado horizontalmente · era right: 24 (thumb-zone right-handed).
  // Usuário pediu centro: stretch full-width + alignItems center → CaptureButton
  // fica no eixo X central, alinhado com Atlas AI button do dock (que também é
  // centro). Fica composição em coluna central: T (capture) acima, ✦ (Atlas AI)
  // abaixo · 16pt de gap entre eles. zIndex 28 mantém abaixo do dock (z 30).
  floatingCapture: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 28,
    alignItems: 'center',
  },
  // v12 · header zone CENTRALIZADO · masthead editorial premium.
  // Antes: zigzag de alinhamento (LiveStatus centro / Inbox esq / tabs centro /
  // domain centro / chips esq) → impressão de tela quebrada. Agora: header zone
  // toda no centro até os tabs, transição clara pra cards (esq) define
  // "saí da capa, entrei no conteúdo" — gramática editorial Aperture/Apartamento.
  // canon mockup .va .masthead-section · text-align center, mt 12,
  // padding-bottom 24, border-bottom 1px @18% ink. Title médio + dateline.
  titleBlock: {
    marginTop: 12,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,22,18,0.18)',
    alignItems: 'center',
  },
  // canon .va .dateline · mt 14, mb 36 (block respira até as view-tabs).
  // Edition mono caps abaixo do date · 4px gap.
  datelineBlock: {
    marginTop: 14,
    marginBottom: 36,
    alignItems: 'center',
  },
  datelineEdition: {
    marginTop: 4,
  },
  // metaRow agora justifica ao centro · segments clusterizados.
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  metaSegment: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uppercase: { textTransform: 'uppercase' },
  // Técnica #4 v5 · letterpress sutil · highlight marfim 1px abaixo simula deboss em papel.
  // RN não suporta múltiplas textShadows como CSS — usamos apenas a highlight clara.
  letterpressTitle: {
    textShadowColor: 'rgba(255, 250, 240, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  // canon mockup view-tabs · gap 16, margin 28/28, justifyContent center.
  // Underline bronze 1.5px (sólido, não transparent) match canon.
  // mt 0 porque dateline já tem mb 36 (canon respira na dateline, não aqui).
  modeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: 16,
    paddingTop: 0,
    paddingBottom: 14,
    marginTop: 0,
    marginBottom: 28,
    position: 'relative',
  },
  // canon .view-tab-sep · "·" Frau 17 ink3 entre Capturas e Operacional.
  modeTabSep: {
    opacity: 0.7,
  },
  // canon · underline bronze sólido 1.5px · bottom -6 do baseline (ajustado
  // pra alinhar dentro do paddingBottom 14 + breath 7).
  modeTabSliderUnderline: {
    position: 'absolute',
    bottom: 7,
    height: 1.5,
    backgroundColor: '#9B7A3F',
    borderRadius: 1,
  },
  // Tab individual · alignItems center → label e subtitle alinhados no eixo X.
  // gap 6 → respiro entre label e subtitle (com underline no meio quando active).
  modeTab: {
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  // Row da label · centro horizontal pra critical dot ficar adjacente sem
  // empurrar a label fora do center.
  modeTabLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 5,
  },
  // v15.1 · removidos modeTabLabelGroup e modeTabUnderline (per-tab) ·
  // substituídos pelo slider único modeTabSliderUnderline. Eram dead code.
  modeTabCriticalDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  filterScroll: { marginBottom: 8 },
  // canon mockup .search-line · hairline-bottom only · padding 14/0 ·
  // mx 32 · sem bg, sem radius, sem shadow.
  searchLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 32,
    marginBottom: 28,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  searchLineInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 0,
    minWidth: 0,
  },
  sortLink: {
    paddingVertical: 6,
    paddingLeft: 4,
    alignSelf: 'center',
  },
  bulkBar: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityBar: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  projectProposal: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
  },
  projectProposalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectProposalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectProposalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 14,
  },
  proposalField: {
    gap: 5,
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  proposalInput: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 17,
  },
  proposalInputMultiline: {
    minHeight: 58,
    textAlignVertical: 'top',
  },
  minutesField: {
    width: 78,
    gap: 5,
  },
  minutesInput: {
    height: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 17,
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  priorityChip: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  actionText: {
    minHeight: 30,
    justifyContent: 'center',
  },
  filterStripWrap: {
    position: 'relative',
    marginHorizontal: 32,
    marginBottom: 28,
  },
  filterFadeEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 6,
    width: 28,
    opacity: 0.9,
  },
  filterEdgeArrow: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -10,
    opacity: 0.7,
  },
  // canon mockup .filter-tabs · gap 8 com separator "·" entre chips.
  // mx 32 vem do filterStripWrap parent. flexWrap evita clipping no mobile:
  // filtros secundários caem para a próxima linha como no folio mockup.
  filterStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: 8,
    paddingRight: 0,
  },
  // canon .filter-tabs .sep · "·" Frau italic 15 ink3 entre chips · sem hit.
  filterChipSep: {
    opacity: 0.7,
  },
  // v12 · underline editorial premium matching ModeTabs.
  // v15 · borderBottomWidth removido · agora underline é Animated.View absoluto
  // sobreposto · permite scaleX + opacity transitions cinéticas.
  // v16 cinema · row layout movido pra filterChipRow (Animated.View interno
  // que carrega o crossfade de opacity). filterChip vira só wrapper de
  // padding+position pro slider absolute funcionar.
  filterChip: {
    paddingHorizontal: 0,
    paddingBottom: 6,
    position: 'relative',
  },
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  // v16 · slider underline único · opacity 60→45% pra whisper. Ainda visível
  // (é selector indicator), mas não compete com codex separators (12-22%).
  filterChipSliderUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(155,122,63,0.45)',
  },
  filterChipActiveUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#9B7A3F',
  },
  filterChipCount: {
    opacity: 0.6,
  },
  operationalFilterScroll: {
    marginTop: -4,
    marginBottom: 10,
  },
  operationalFilterStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  operationalFilterChip: {
    minHeight: 31,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  loadMoreOperational: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  operationalSummary: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  operationalSummaryBadge: {
    minWidth: 38,
    height: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  // canon mockup op-empty / op-clean · hairline-top 1px @18% ink, padding-top
  // 28, mx 32, mt 56. Sem bg, sem radius, sem border lateral. Vocabulário
  // editorial puro · "página dentro da página".
  opEmptyCanon: {
    marginHorizontal: 32,
    marginTop: 56,
    paddingTop: 28,
    borderTopWidth: 1,
  },
  opEmptyEyebrow: {
    marginBottom: 8,
  },
  opEmptyState: {
    marginBottom: 14,
  },
  opEmptyProse: {
    marginBottom: 22,
  },
  opEmptyProseClean: {
    marginBottom: 0,
  },
  opEmptyAction: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1.5,
    paddingBottom: 3,
  },
  operationalErrorCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  operationalRetryButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  list: { gap: 10 },
  firstSection: { marginTop: 18 },
})
