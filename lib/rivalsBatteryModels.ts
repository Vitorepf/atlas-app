import type { AtlasEngineeringBenchmarkRunInput } from './api/client'

export type RivalsBatteryMode = 'official_fair' | 'same_model' | 'max'

export interface RivalsBatteryLaunchOptions {
  baselineWorkspace: string
  caseLimit: string
  mode: RivalsBatteryMode
  model: string
  provider: string
  workspace: string
}

export interface RivalsBatteryLaunchPlan {
  baseline: string
  blockers: string[]
  cases: string
  model: string
  provider: string
  ready: boolean
  summary: string
  title: string
}

export function buildRivalsBatteryInput({
  baselineWorkspace,
  caseLimit,
  mode,
  model,
  provider,
  workspace,
}: RivalsBatteryLaunchOptions): AtlasEngineeringBenchmarkRunInput {
  const limit = safeRivalsCaseLimit(caseLimit)
  const base: AtlasEngineeringBenchmarkRunInput = {
    workspace,
    auto_test: true,
    limit,
    corpus_tier: 'release',
    sandbox: 'worktree',
    provider_runtime: 'host',
    release_gate_profile: mode === 'max' ? 'strict' : 'release',
    quality_scan: 'required',
    quality_profile: mode === 'max' ? 'release' : 'standard',
    quality_changed_only: true,
    no_provider: false,
  }

  if (mode === 'official_fair') {
    return {
      ...base,
      provider: 'claude_cli',
      model: 'opus',
      model_policy: 'fixed',
      fair_mode: true,
      claude_only: true,
      single_provider: true,
      no_decide: true,
      fallback_disabled: true,
      require_pass_without_human: true,
      claude_code_baseline: 'run',
      claude_code_baseline_mode: 'run',
      claude_code_baseline_model: 'opus',
      claude_code_baseline_workspace: baselineWorkspace,
      baseline_runner: 'run',
      baseline_model: 'opus',
      max_attempts: 3,
    }
  }

  if (mode === 'same_model') {
    return {
      ...base,
      provider,
      model,
      model_policy: 'fixed',
      complete: true,
      max_attempts: 3,
      runner_options: {
        rivalry_mode: 'same_model_fixed_provider',
        comparison_note: 'Provider/model fixed for Atlas arm; paired external baseline depends on provider-specific runner support.',
      },
    }
  }

  return {
    ...base,
    provider: provider || null,
    model: model || null,
    model_policy: 'best-quality',
    complete: true,
    max_attempts: 5,
    runner_options: {
      rivalry_mode: 'atlas_max_intelligence',
      provider_selection: 'best_quality_with_operator_preference',
      allow_decide: true,
    },
  }
}

export function rivalsBatteryModeDetail(mode: RivalsBatteryMode): string {
  if (mode === 'official_fair') {
    return 'Benchmark justo oficial: Atlas usa claude_cli/opus, baseline usa Claude Code/opus em workspace separado, fallback e decide bloqueados.'
  }
  if (mode === 'same_model') {
    return 'Batalha justa por provider fixo: Atlas roda com o provider/modelo escolhido, sem política de modelo dinâmica. O baseline pareado depende de runner externo equivalente.'
  }
  return 'Modo máximo: Atlas usa harness completo, best-quality, mais tentativas e gates estritos. Serve para medir o melhor Atlas, não uma comparação isolada de modelo.'
}

export function rivalsBatteryLaunchPlan({
  baselineWorkspace,
  caseLimit,
  mode,
  model,
  provider,
  workspace,
}: RivalsBatteryLaunchOptions): RivalsBatteryLaunchPlan {
  const blockers: string[] = []
  const resolvedWorkspace = workspace.trim()
  const resolvedProvider = provider.trim()
  const resolvedModel = model.trim()
  const safeLimit = safeRivalsCaseLimit(caseLimit)

  if (!resolvedWorkspace) blockers.push('workspace_atlas_required')
  if (mode === 'official_fair' && !baselineWorkspace.trim()) blockers.push('separate_baseline_workspace_required')
  if (mode !== 'max' && !resolvedProvider) blockers.push('provider_required')
  if (mode !== 'max' && !resolvedModel) blockers.push('model_required')

  if (mode === 'official_fair') {
    return {
      baseline: 'pareado',
      blockers,
      cases: String(safeLimit),
      model: 'opus',
      provider: 'claude_cli',
      ready: blockers.length === 0,
      summary: 'Comparação oficial com baseline Claude Code em workspace separado, provider/modelo fixos e fallback bloqueado.',
      title: 'Fair Claude pareado',
    }
  }

  if (mode === 'same_model') {
    return {
      baseline: 'atlas fixo',
      blockers,
      cases: String(safeLimit),
      model: resolvedModel || '-',
      provider: resolvedProvider || '-',
      ready: blockers.length === 0,
      summary: 'Atlas roda com provider/modelo fixos. Use para isolar comportamento do Atlas; baseline externo equivalente ainda precisa runner dedicado.',
      title: 'Mesmo provider/modelo',
    }
  }

  return {
    baseline: 'não pareado',
    blockers,
    cases: String(safeLimit),
    model: resolvedModel || 'best-quality',
    provider: resolvedProvider || 'policy',
    ready: blockers.length === 0,
    summary: 'Atlas roda no modo mais forte com best-quality, mais tentativas e gates estritos. Mede capacidade máxima, não justiça isolada.',
    title: 'Atlas máximo',
  }
}

export function safeRivalsCaseLimit(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10)

  return Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 6
}
