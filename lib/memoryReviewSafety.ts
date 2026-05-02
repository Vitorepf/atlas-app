export type ProviderSafetySeverity = 'high' | 'medium' | 'low'

export type ProviderSafetyIssue = {
  key: string
  severity: ProviderSafetySeverity
  label: string
  detail: string
  sample: string
}

export type ProviderReviewDiffInput = {
  key: string
  label: string
  current?: string | null
  proposed?: string | null
}

export type ProviderReviewDiff = ProviderReviewDiffInput & {
  changed: boolean
  current_excerpt: string
  proposed_excerpt: string
}

type SafetyPattern = {
  key: string
  severity: ProviderSafetySeverity
  label: string
  detail: string
  pattern: RegExp
}

const SAFETY_PATTERNS: SafetyPattern[] = [
  {
    key: 'bearer_token',
    severity: 'high',
    label: 'Bearer token',
    detail: 'Texto ainda parece conter token Bearer.',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/i,
  },
  {
    key: 'jwt',
    severity: 'high',
    label: 'JWT',
    detail: 'Texto ainda parece conter JWT completo.',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    key: 'private_key',
    severity: 'high',
    label: 'Private key',
    detail: 'Texto ainda parece conter marcador de chave privada.',
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----/i,
  },
  {
    key: 'cloud_access_key',
    severity: 'high',
    label: 'Cloud key',
    detail: 'Texto ainda parece conter chave de acesso cloud.',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    key: 'provider_token',
    severity: 'high',
    label: 'Provider token',
    detail: 'Texto ainda parece conter token de provider ou plataforma.',
    pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i,
  },
  {
    key: 'secret_assignment',
    severity: 'medium',
    label: 'Secret assignment',
    detail: 'Texto ainda parece conter atribuicao de segredo.',
    pattern: /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{8,}/i,
  },
]

export function detectProviderSafetyIssues(value: string | null | undefined): ProviderSafetyIssue[] {
  const text = value ?? ''
  if (text.trim() === '') return []

  const issues: ProviderSafetyIssue[] = []
  for (const rule of SAFETY_PATTERNS) {
    const match = text.match(rule.pattern)
    if (!match?.[0]) continue

    issues.push({
      key: rule.key,
      severity: rule.severity,
      label: rule.label,
      detail: rule.detail,
      sample: maskSensitiveSample(match[0]),
    })
  }

  return issues
}

export function hasHighProviderSafetyRisk(value: string | null | undefined): boolean {
  return detectProviderSafetyIssues(value).some((issue) => issue.severity === 'high')
}

export function buildProviderReviewDiff(fields: ProviderReviewDiffInput[]): ProviderReviewDiff[] {
  return fields.map((field) => {
    const current = normalizeDiffValue(field.current)
    const proposed = normalizeDiffValue(field.proposed)

    return {
      ...field,
      changed: current !== proposed,
      current_excerpt: excerpt(current),
      proposed_excerpt: excerpt(proposed),
    }
  })
}

function normalizeDiffValue(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function excerpt(value: string): string {
  if (value === '') return 'vazio'
  return value.length > 260 ? `${value.slice(0, 257)}...` : value
}

function maskSensitiveSample(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 10) return '[masked]'

  return `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`
}
