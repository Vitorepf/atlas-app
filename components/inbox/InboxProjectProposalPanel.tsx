import { TextInput, View } from 'react-native'
import { Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { TASK_PRIORITIES } from '../../lib/inboxConstants'
import type { ProjectPlanDraft } from '../../lib/inboxTypes'
import type { AtlasProjectPlanProposal } from '../../lib/api/client'
import { ActionText, LabeledInput, PriorityChip, ProposalText } from './InboxControls'
import { styles } from './inboxScreenStyles'

interface Props {
  draft: ProjectPlanDraft
  onCancel: () => void
  onChangeDraft: (updater: (draft: ProjectPlanDraft) => ProjectPlanDraft) => void
  onConfirm: () => void
  onRegenerate: () => void
  proposal: AtlasProjectPlanProposal
}

export function InboxProjectProposalPanel({
  draft,
  onCancel,
  onChangeDraft,
  onConfirm,
  onRegenerate,
  proposal,
}: Props) {
  const c = usePalette()

  return (
    <View style={[styles.projectProposal, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.projectProposalHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sans weight="sb" size={12} lineHeight={16} color={c.ink}>
            Proposta de projeto
          </Sans>
          <Sans size={11.5} lineHeight={15} color={c.ink2} numberOfLines={1}>
            IA propõe. Vitor confirma.
          </Sans>
        </View>
        <Sans weight="sb" size={11} lineHeight={14} color={c.bronze}>
          {String(proposal.project_type).replace('_', ' ').toUpperCase()}
        </Sans>
      </View>

      <LabeledInput
        label="título"
        value={draft.title}
        onChangeText={(title) => onChangeDraft((current) => ({ ...current, title }))}
      />
      <ProposalText label="resultado" value={proposal.desired_outcome} />
      <ProposalText label="menor resultado útil" value={proposal.minimum_useful_result} />
      <LabeledInput
        label="próxima ação"
        value={draft.nextAction}
        multiline
        onChangeText={(nextAction) => onChangeDraft((current) => ({ ...current, nextAction }))}
      />

      <View style={styles.projectProposalRow}>
        <View style={{ flex: 1 }}>
          <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
            prioridade
          </Sans>
          <View style={styles.priorityOptions}>
            {TASK_PRIORITIES.map((priority) => (
              <PriorityChip
                key={priority.key}
                label={priority.label}
                tone={draft.priority === priority.key ? priority.key : 'neutral'}
                onPress={() => onChangeDraft((current) => ({ ...current, priority: priority.key }))}
              />
            ))}
          </View>
        </View>
        <View style={styles.minutesField}>
          <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
            minutos
          </Sans>
          <TextInput
            value={draft.estimatedMinutes}
            onChangeText={(estimatedMinutes) => onChangeDraft((current) => ({ ...current, estimatedMinutes }))}
            keyboardType="number-pad"
            placeholder="25"
            placeholderTextColor={c.ink2}
            style={[styles.minutesInput, { color: c.ink, borderColor: c.border }]}
          />
        </View>
      </View>

      <ProposalText label="por que o Atlas sugeriu" value={proposal.rationale} />

      <View style={styles.projectProposalActions}>
        <ActionText label="Cancelar" onPress={onCancel} />
        <ActionText label="Regerar" onPress={onRegenerate} />
        <ActionText label="Confirmar projeto" onPress={onConfirm} />
      </View>
    </View>
  )
}
