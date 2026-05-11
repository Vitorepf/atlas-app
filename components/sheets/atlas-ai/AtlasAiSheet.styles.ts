import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Header 3-column · canon mockup atlas-ai-header (linha 2184).
  // alignItems baseline (não center) — alinha tipografia pelo baseline,
  // que é como mockup "Atlas" Frau 26 alinha com "← Voltar" Sans 15 e
  // ícones na direita. Editorial > geométrico.
  // Sem height fixo — paddingTop+paddingBottom controlam respiração.
  // borderBottomColor é setado inline com bronze@18% (vocabulário canon
  // do mockup, não c.border cinza).
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  // headerSlot esquerdo/direito flex 1 — empurra título "Atlas" pra centro
  // sem largura fixa. Mockup: .left { flex: 1 } / .right { flex: 1 }.
  headerSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  headerSlotRight: {
    alignItems: 'flex-end',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 18,
  },
  headerAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  threadHeader: {
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  threadListContent: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    flexGrow: 1,
  },
  errorRow: {
    paddingBottom: 24,
  },
  turn: {
    paddingBottom: 8,
  },
  turnSeparator: {
    marginBottom: 48,
  },
  afterQuote: {
    marginTop: 20,
  },
  // Footer (composer + status routing) · canon mockup atlas-ai-composer
  // (linha 2316). paddingHorizontal 24 (não 28 ad-hoc anterior) — alinha
  // com o mesmo trilho horizontal do header (24px). paddingTop 4 mantido,
  // paddingBottom dinâmico via footerPaddingBottom (insets safe-area iPhone).
  footer: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  copyToast: {
    position: 'absolute',
    top: -28,
    left: 28,
    right: 28,
    alignItems: 'center',
  },
})
