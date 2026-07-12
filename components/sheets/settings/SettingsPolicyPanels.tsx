import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import {
  type AtlasAiPolicyPreviewResponse,
  type AtlasAiPolicyProfilesResponse,
} from '../../../lib/api/client'
import {
  type SegOption,
  effectivePolicyMetricRows,
  policyFlowOptions,
} from './settingsStatus'

export function PolicyFlowPicker({
  profiles,
  selectedFlowId,
  onSelect,
}: {
  profiles: AtlasAiPolicyProfilesResponse | null
  selectedFlowId: string
  onSelect: (flowId: string) => void
}) {
  const { c } = useTheme()
  const flows = policyFlowOptions(profiles)

  if (flows.length === 0) {
    return (
      <View style={styles.profileFlowEmpty}>
        <Sans size={12} lineHeight={17} color={c.ink2}>
          Catálogo de perfis indisponível.
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.profileFlowGrid}>
      {flows.map((flow) => {
        const selected = flow.id === selectedFlowId
        return (
          <Pressable
            key={flow.id}
            onPress={() => onSelect(flow.id)}
            style={({ pressed }) => [
              styles.profileFlowChip,
              {
                borderColor: selected ? c.prussian : c.border,
                backgroundColor: selected ? c.surface : pressed ? c.surface : 'transparent',
              },
            ]}
          >
            <Mono size={10} letterSpacing={0.34} color={selected ? c.prussian : c.ink2}>
              {flow.id}
            </Mono>
            <Sans size={11} lineHeight={14} color={c.ink2}>
              {flow.runtime ?? flow.orchestrator ?? flow.autonomy ?? 'policy'}
            </Sans>
          </Pressable>
        )
      })}
    </View>
  )
}

export function EffectivePolicyPreviewPanel({
  preview,
  loading,
}: {
  preview: AtlasAiPolicyPreviewResponse | null
  loading: boolean
}) {
  const { c } = useTheme()
  const rows = effectivePolicyMetricRows(preview)

  if (loading || rows.length === 0) {
    return (
      <View style={styles.policyPreviewEmpty}>
        <Sans size={12} lineHeight={17} color={c.ink2}>
          {loading ? 'Calculando política efetiva...' : 'Sem preview efetivo para este fluxo.'}
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.policyPreviewGrid}>
      {rows.map((row) => (
        <View key={row.label} style={[styles.policyPreviewMetric, { borderColor: c.border }]}>
          <Mono size={9.5} letterSpacing={0.28} color={c.ink2}>
            {row.label}
          </Mono>
          <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
            {row.value}
          </Sans>
          <Sans size={11} lineHeight={14} color={c.ink2}>
            {row.desc}
          </Sans>
        </View>
      ))}
    </View>
  )
}

export function RuntimeButton({
  label,
  disabled,
  danger,
  onPress,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  const color = danger ? c.recRed : c.prussian

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.runtimeButton,
        {
          borderColor: color,
          backgroundColor: pressed ? c.surface : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12} color={color} align="center">
        {label}
      </Sans>
    </Pressable>
  )
}

export function ChoiceButton({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string
  options: SegOption[]
  disabled?: boolean
  onChange: (k: string) => void
}) {
  const { c, name } = useTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.key === value) ?? options[0]

  const handleChange = (key: string) => {
    setOpen(false)
    onChange(key)
  }

  return (
    <View style={choiceStyles.wrap}>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          choiceStyles.button,
          {
            borderColor: open ? c.prussian : c.border,
            backgroundColor: pressed || open ? c.surface : 'transparent',
            opacity: disabled ? 0.45 : 1,
            shadowColor: name === 'dark' ? '#000' : '#1A1612',
          },
        ]}
      >
        <Sans weight="med" size={13.5} lineHeight={18} color={c.ink} numberOfLines={1}>
          {selected?.label ?? value}
        </Sans>
        <Mono size={12} letterSpacing={0.2} color={open ? c.prussian : c.ink2}>
          {open ? '↑' : '↓'}
        </Mono>
      </Pressable>
      {open && options.length > 0 ? (
        <View style={[choiceStyles.menu, { borderColor: c.border, backgroundColor: c.bg }]}>
          {options.map((option, index) => {
            const current = option.key === selected?.key
            return (
            <Pressable
              key={option.key}
              onPress={() => handleChange(option.key)}
              style={({ pressed }) => [
                choiceStyles.option,
                index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
                (pressed || current) && { backgroundColor: c.surface },
              ]}
            >
              <Sans weight="med" size={13} lineHeight={18} color={current ? c.ink : c.ink2} numberOfLines={1}>
                {option.label}
              </Sans>
            </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  profileFlowGrid: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileFlowChip: {
    width: '48%',
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  profileFlowEmpty: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  policyPreviewGrid: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  policyPreviewMetric: {
    width: '48%',
    minHeight: 74,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  policyPreviewEmpty: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  runtimeButton: {
    flex: 1,
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const choiceStyles = StyleSheet.create({
  wrap: {
    width: 168,
    alignItems: 'stretch',
    gap: 6,
  },
  button: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  menu: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  option: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
})
