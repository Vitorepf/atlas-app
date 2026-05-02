import assert from 'node:assert/strict'
import {
  buildProviderReviewDiff,
  detectProviderSafetyIssues,
  hasHighProviderSafetyRisk,
} from '../lib/memoryReviewSafety'

{
  const issues = detectProviderSafetyIssues('Use Bearer abcdefghijklmno before calling the provider.')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].key, 'bearer_token')
  assert.equal(issues[0].severity, 'high')
  assert.equal(hasHighProviderSafetyRisk('Authorization: Bearer abcdefghijklmno'), true)
}

{
  const issues = detectProviderSafetyIssues('OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456')
  assert.equal(issues.some((issue) => issue.key === 'provider_token'), true)
}

{
  const issues = detectProviderSafetyIssues('password="supersecretvalue" should not be provider-safe')
  assert.equal(issues[0].key, 'secret_assignment')
  assert.equal(issues[0].severity, 'medium')
  assert.equal(hasHighProviderSafetyRisk('password="supersecretvalue"'), false)
}

{
  assert.deepEqual(detectProviderSafetyIssues('Provider-safe summary with no secrets.'), [])
}

{
  const diff = buildProviderReviewDiff([
    { key: 'body', label: 'Body', current: 'Token Bearer abcdefghijklmno removed.', proposed: 'Token removed.' },
    { key: 'summary', label: 'Resumo', current: 'Same value', proposed: 'Same   value' },
  ])
  assert.equal(diff[0].changed, true)
  assert.equal(diff[1].changed, false)
  assert.equal(diff[0].current_excerpt.includes('Bearer'), true)
}

console.log('memory review safety tests passed')
