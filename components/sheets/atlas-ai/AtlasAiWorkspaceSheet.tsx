import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Frau, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type { AtlasWorkspaceProfile } from '../../../lib/api/client'
import { BottomSheet } from '../BottomSheet'
import {
  type AtlasAiMobileWorkspaceLock,
  workspacePickerOptions,
} from './AtlasAiMobileWorkspaceModel'

interface Props {
  visible: boolean
  profiles: AtlasWorkspaceProfile[]
  active: AtlasAiMobileWorkspaceLock
  loading: boolean
  creating: boolean
  onClose: () => void
  onSelect: (slug: string) => void
  onCreate: (input: { slug: string; name: string; workspacePath: string }) => void
}

export function AtlasAiWorkspaceSheet({
  visible,
  profiles,
  active,
  loading,
  creating,
  onClose,
  onSelect,
  onCreate,
}: Props) {
  const { c } = useTheme()
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')

  useEffect(() => {
    if (visible) {
      setQuery('')
      setCreateOpen(false)
      setNewName('')
      setNewPath('')
    }
  }, [visible])

  const filteredProfiles = useMemo(
    () => workspacePickerOptions(profiles, query),
    [profiles, query],
  )
  const locked = active.locked
  const inferredSlug = slugFromNameOrPath(newName || query || newPath)
  const canCreate = inferredSlug !== '' && newName.trim() !== '' && newPath.trim() !== ''

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%" scrimStrength="strong">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={localStyles.scroll}
      >
        <View style={localStyles.header}>
          <Mono size={11} lineHeight={15} letterSpacing={1.9} color={c.bronze}>
            WORKSPACE AWIS
          </Mono>
          <Frau italic size={28} lineHeight={34} color={c.ink}>
            Escolher projeto
          </Frau>
          <Sans size={14.5} lineHeight={21} color={c.ink2}>
            O projeto define memória, contexto, testes, Cartografia e limites desta conversa.
          </Sans>
        </View>

        <View style={[localStyles.activeBox, { borderColor: locked ? c.bronzeDeep : c.border, backgroundColor: c.bgRaised }]}>
          <Mono size={10} lineHeight={14} letterSpacing={1.5} color={locked ? c.bronze : c.ink3}>
            {locked ? 'FIXO NESTA CONVERSA' : 'ATIVO AGORA'}
          </Mono>
          <Frau italic size={20} lineHeight={26} color={c.ink}>
            {active.workspaceName ?? active.workspaceSlug ?? 'nenhum projeto'}
          </Frau>
          {active.workspacePath ? (
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink3} style={localStyles.pathText}>
              {active.workspacePath}
            </Mono>
          ) : null}
          {locked ? (
            <Sans size={13.5} lineHeight={19} color={c.ink2}>
              Para trocar, abra uma nova conversa. Isso evita misturar memória e arquivos de projetos diferentes.
            </Sans>
          ) : null}
        </View>

        {!locked ? (
          <View style={[localStyles.searchBox, { borderColor: c.border, backgroundColor: c.bgRaised }]}>
            <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink3}>
              BUSCAR PROJETO
            </Mono>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Atlas, blackink, caminho ou stack"
              placeholderTextColor={c.ink3}
              autoCorrect={false}
              autoCapitalize="none"
              style={[localStyles.input, { color: c.ink }]}
            />
          </View>
        ) : null}

        <View style={localStyles.list}>
          {loading ? (
            <Sans size={15} lineHeight={22} color={c.ink2}>
              Carregando projetos...
            </Sans>
          ) : filteredProfiles.length === 0 ? (
            <Sans size={15} lineHeight={22} color={c.ink2}>
              Nenhum projeto encontrado.
            </Sans>
          ) : (
            filteredProfiles.map((profile, index) => {
              const selected = profile.slug === active.workspaceSlug
              const disabled = locked || selected
              return (
                <Pressable
                  key={profile.slug}
                  disabled={disabled}
                  onPress={() => onSelect(profile.slug)}
                  style={({ pressed }) => [
                    localStyles.workspaceRow,
                    {
                      borderTopColor: index === 0 ? 'transparent' : `${c.ink}1F`,
                      opacity: pressed ? 0.62 : disabled && !selected ? 0.45 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`selecionar workspace ${profile.name || profile.slug}`}
                >
                  <View style={[localStyles.dot, { backgroundColor: selected ? c.bronze : c.border }]} />
                  <View style={localStyles.rowText}>
                    <Frau italic size={18} lineHeight={23} color={selected ? c.bronzeLight : c.ink}>
                      {profile.name || profile.slug}
                    </Frau>
                    <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink3} style={localStyles.pathText}>
                      {profile.workspace_path ?? profile.repo_root ?? profile.slug}
                    </Mono>
                    {profile.stack_summary ? (
                      <Sans size={12.5} lineHeight={17} color={c.ink2}>
                        {profile.stack_summary}
                      </Sans>
                    ) : null}
                  </View>
                  <Mono size={10} lineHeight={14} letterSpacing={1.2} color={selected ? c.bronze : c.ink3}>
                    {selected ? 'ATIVO' : locked ? 'FIXO' : 'USAR'}
                  </Mono>
                </Pressable>
              )
            })
          )}
        </View>

        {!locked ? (
          <View style={[localStyles.createBox, { borderColor: c.border, backgroundColor: c.bgRaised }]}>
            <Pressable
              onPress={() => setCreateOpen((current) => !current)}
              style={localStyles.createToggle}
              accessibilityRole="button"
              accessibilityLabel="adicionar novo projeto"
            >
              <Mono size={10} lineHeight={14} letterSpacing={1.6} color={c.bronze}>
                ADICIONAR NOVO PROJETO
              </Mono>
              <Frau italic size={16} lineHeight={21} color={c.ink2}>
                {createOpen ? 'ocultar' : 'cadastrar workspace'}
              </Frau>
            </Pressable>

            {createOpen ? (
              <View style={localStyles.createForm}>
                <WorkspaceTextField
                  label="nome"
                  value={newName}
                  placeholder="Blackink"
                  onChangeText={setNewName}
                />
                <WorkspaceTextField
                  label="pasta local"
                  value={newPath}
                  placeholder="/Users/vitorepf/develop/blackink"
                  onChangeText={setNewPath}
                />
                <View style={[localStyles.slugPreview, { borderColor: `${c.ink}1F` }]}>
                  <Mono size={10} lineHeight={14} letterSpacing={1.2} color={c.ink3}>
                    SLUG
                  </Mono>
                  <Sans size={14} lineHeight={19} color={c.ink2}>
                    {inferredSlug || 'preencha nome ou pasta'}
                  </Sans>
                </View>
                <Pressable
                  disabled={!canCreate || creating}
                  onPress={() => {
                    if (!canCreate) return
                    onCreate({
                      slug: inferredSlug,
                      name: newName.trim(),
                      workspacePath: newPath.trim(),
                    })
                  }}
                  style={({ pressed }) => [
                    localStyles.createButton,
                    {
                      backgroundColor: canCreate ? c.bronze : c.bg,
                      opacity: pressed ? 0.72 : creating ? 0.55 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="salvar novo workspace"
                >
                  <Mono size={11} lineHeight={15} letterSpacing={1.5} color={canCreate ? c.bg : c.ink3}>
                    {creating ? 'SALVANDO' : 'SALVAR WORKSPACE'}
                  </Mono>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  )
}

function WorkspaceTextField({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string
  value: string
  placeholder: string
  onChangeText: (text: string) => void
}) {
  const { c } = useTheme()
  return (
    <View style={[localStyles.field, { borderColor: `${c.ink}1F` }]}>
      <Mono size={10} lineHeight={14} letterSpacing={1.2} color={c.ink3}>
        {label.toUpperCase()}
      </Mono>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        autoCorrect={false}
        autoCapitalize="none"
        style={[localStyles.input, { color: c.ink }]}
      />
    </View>
  )
}

function slugFromNameOrPath(value: string): string {
  const pathParts = value.trim().split('/').filter(Boolean)
  const lastPathPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : value
  return lastPathPart
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const localStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 42,
    gap: 18,
  },
  header: {
    gap: 8,
  },
  activeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  searchBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  input: {
    fontSize: 17,
    lineHeight: 23,
    padding: 0,
    fontFamily: 'Inter_400Regular',
  },
  list: {
    gap: 0,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  pathText: {
    flexShrink: 1,
  },
  createBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 14,
  },
  createToggle: {
    gap: 5,
  },
  createForm: {
    gap: 10,
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 9,
    gap: 6,
  },
  slugPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  createButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    minHeight: 44,
  },
})
