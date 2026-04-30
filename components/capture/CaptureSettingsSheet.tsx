import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from '../sheets/BottomSheet'
import { Frau, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BronzeDiamond } from '../console/BronzeDiamond'
import {
  type CaptureMode,
  type CaptureSensitivity,
  useOverlays,
} from '../../lib/overlays'

const MODE_OPTIONS: Array<{ key: CaptureMode; label: string }> = [
  { key: 'text',  label: 'Texto' },
  { key: 'audio', label: 'Áudio' },
  { key: 'photo', label: 'Foto' },
]

const SENSITIVITY_OPTIONS: Array<{ key: CaptureSensitivity; label: string; gloss?: string }> = [
  { key: 'normal',    label: 'Normal',    gloss: 'pode ir para IA externa' },
  { key: 'private',   label: 'Privada',   gloss: 'fica apenas no Atlas' },
  { key: 'sensitive', label: 'Sensível',  gloss: 'isolada, sem rotação externa' },
]

// Sheet handles modo + sensibilidade for capture. Domínio is intentionally
// absent — it's asked at save time via the DomainSheet, not pre-set here
// (avoids the "saved to wrong domain" footgun). Each tap commits that
// field immediately and closes. Mounted via OverlayHost.
export function CaptureSettingsSheet() {
  const c = usePalette()
  const open = useOverlays((s) => s.open)
  const current = useOverlays((s) => s.captureSettings)
  const onUpdate = useOverlays((s) => s.onUpdateCaptureSettings)
  const close = useOverlays((s) => s.close)
  const visible = open === 'captureSettings'

  const commit = (partial: Parameters<NonNullable<typeof onUpdate>>[0]) => {
    onUpdate?.(partial)
    close()
  }

  return (
    <BottomSheet visible={visible} onClose={close} height="85%">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.diamondRow}>
          <BronzeDiamond size={18} />
        </View>

        <Frau size={26} lineHeight={32} align="center" color={c.ink} style={styles.heading}>
          Como capturar?
        </Frau>

        <View style={[styles.headingRule, { backgroundColor: c.border }]} />

        <Section label="modo">
          <ChipRow>
            {MODE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                active={current?.mode === option.key}
                onPress={() => commit({ mode: option.key })}
              />
            ))}
          </ChipRow>
        </Section>

        <Section label="sensibilidade">
          <View style={styles.sensitivityList}>
            {SENSITIVITY_OPTIONS.map((option) => (
              <SensitivityRow
                key={option.key}
                label={option.label}
                gloss={option.gloss}
                active={current?.sensitivity === option.key}
                onPress={() => commit({ sensitivity: option.key })}
              />
            ))}
          </View>
        </Section>
      </ScrollView>
    </BottomSheet>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const c = usePalette()
  return (
    <View style={styles.section}>
      <Frau italic size={15} lineHeight={20} color={c.ink} style={{ opacity: 0.6 }}>
        {label}
      </Frau>
      <View style={[styles.sectionRule, { backgroundColor: c.border }]} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>
}

function ChoiceChip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string
  active: boolean
  accent?: string
  onPress: () => void
}) {
  const c = usePalette()
  const activeBg = accent ?? c.prussian
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? activeBg : 'transparent',
          borderColor: active ? activeBg : c.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Sans weight="med" size={14} color={active ? c.bg : c.ink}>
        {label}
      </Sans>
    </Pressable>
  )
}

function SensitivityRow({
  label,
  gloss,
  active,
  onPress,
}: {
  label: string
  gloss?: string
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sensitivityRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.sensitivityMarker}>
        {active ? <BronzeDiamond size={12} /> : null}
      </View>
      <View style={styles.sensitivityBody}>
        <Frau size={18} lineHeight={24} color={c.ink}>
          {label}
        </Frau>
        {gloss ? (
          <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.45, marginTop: 2 }}>
            — {gloss}
          </Frau>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
  },
  diamondRow: { alignItems: 'center', marginBottom: 14 },
  heading: { paddingHorizontal: 12 },
  headingRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 28,
  },
  section: { marginBottom: 28 },
  sectionRule: { height: StyleSheet.hairlineWidth, marginTop: 8 },
  sectionBody: { marginTop: 14 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensitivityList: { gap: 16 },
  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  sensitivityMarker: { width: 24, paddingTop: 6 },
  sensitivityBody: { flex: 1 },
})
