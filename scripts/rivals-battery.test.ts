import assert from 'node:assert/strict'
import {
  buildRivalsBatteryInput,
  rivalsBatteryLaunchPlan,
  rivalsBatteryModeDetail,
  safeRivalsCaseLimit,
} from '../lib/rivalsBatteryModels'

const workspace = '/Users/vitorepf/develop/Atlas/atlas-server'
const baselineWorkspace = '/Users/vitorepf/develop/Atlas/atlas-baseline'

{
  const plan = rivalsBatteryLaunchPlan({
    baselineWorkspace,
    caseLimit: '40',
    mode: 'official_fair',
    model: 'ignored',
    provider: 'ignored',
    workspace,
  })
  assert.equal(plan.ready, true)
  assert.equal(plan.baseline, 'pareado')
  assert.equal(plan.provider, 'claude_cli')
  assert.equal(plan.model, 'opus')
  assert.equal(plan.cases, '30')

  const input = buildRivalsBatteryInput({
    baselineWorkspace,
    caseLimit: '40',
    mode: 'official_fair',
    model: 'ignored',
    provider: 'ignored',
    workspace,
  })
  assert.equal(input.provider, 'claude_cli')
  assert.equal(input.model, 'opus')
  assert.equal(input.model_policy, 'fixed')
  assert.equal(input.fair_mode, true)
  assert.equal(input.no_decide, true)
  assert.equal(input.fallback_disabled, true)
  assert.equal(input.claude_code_baseline_workspace, baselineWorkspace)
  assert.equal(input.limit, 30)
}

{
  const plan = rivalsBatteryLaunchPlan({
    baselineWorkspace: '',
    caseLimit: '6',
    mode: 'official_fair',
    model: 'opus',
    provider: 'claude_cli',
    workspace,
  })
  assert.equal(plan.ready, false)
  assert.deepEqual(plan.blockers, ['separate_baseline_workspace_required'])
}

{
  const plan = rivalsBatteryLaunchPlan({
    baselineWorkspace: '',
    caseLimit: '0',
    mode: 'same_model',
    model: 'gpt-5.5',
    provider: 'codex_cli',
    workspace,
  })
  assert.equal(plan.ready, true)
  assert.equal(plan.provider, 'codex_cli')
  assert.equal(plan.model, 'gpt-5.5')
  assert.equal(plan.cases, '1')

  const input = buildRivalsBatteryInput({
    baselineWorkspace: '',
    caseLimit: '0',
    mode: 'same_model',
    model: 'gpt-5.5',
    provider: 'codex_cli',
    workspace,
  })
  assert.equal(input.provider, 'codex_cli')
  assert.equal(input.model, 'gpt-5.5')
  assert.equal(input.model_policy, 'fixed')
  assert.equal(input.complete, true)
  assert.equal(input.max_attempts, 3)
  assert.equal(input.runner_options?.rivalry_mode, 'same_model_fixed_provider')
}

{
  const plan = rivalsBatteryLaunchPlan({
    baselineWorkspace: '',
    caseLimit: 'abc',
    mode: 'max',
    model: '',
    provider: '',
    workspace,
  })
  assert.equal(plan.ready, true)
  assert.equal(plan.provider, 'policy')
  assert.equal(plan.model, 'best-quality')
  assert.equal(plan.cases, '6')

  const input = buildRivalsBatteryInput({
    baselineWorkspace: '',
    caseLimit: 'abc',
    mode: 'max',
    model: '',
    provider: '',
    workspace,
  })
  assert.equal(input.model_policy, 'best-quality')
  assert.equal(input.release_gate_profile, 'strict')
  assert.equal(input.quality_profile, 'release')
  assert.equal(input.max_attempts, 5)
  assert.equal(input.runner_options?.allow_decide, true)
}

assert.equal(safeRivalsCaseLimit('abc'), 6)
assert.equal(safeRivalsCaseLimit('-10'), 1)
assert.equal(safeRivalsCaseLimit('99'), 30)
assert.match(rivalsBatteryModeDetail('same_model'), /provider fixo/i)

console.info('rivals battery tests passed')
