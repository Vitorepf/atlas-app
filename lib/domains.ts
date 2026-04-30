import { darkPalette, type AtlasPalette } from '../design/tokens'

export type DomainKey = string

export interface Domain {
  key: DomainKey
  label: string
  description?: string | null
  colorLight?: string | null
  colorDark?: string | null
  defaultSensitivity?: 'normal' | 'private' | 'sensitive' | string | null
  externalAiPolicy?: 'allow' | 'block_private_sensitive' | 'block_all' | string | null
  active?: boolean
  sortOrder?: number
}

export const DEFAULT_DOMAINS: Domain[] = [
  { key: 'blackink', label: 'BlackInk' },
  { key: 'atlas',    label: 'Atlas', defaultSensitivity: 'private' },
  { key: 'saude',    label: 'Saúde' },
  { key: 'financas', label: 'Finanças' },
  { key: 'outro',    label: 'Outro' },
]

export const DOMAINS = DEFAULT_DOMAINS

export function domainLabel(key: DomainKey, domains: Domain[] = DEFAULT_DOMAINS): string {
  return domains.find((d) => d.key === key)?.label ?? key
}

export function domainColor(key: DomainKey, c: AtlasPalette, domains: Domain[] = DEFAULT_DOMAINS): string {
  const configured = domains.find((domain) => domain.key === key)
  if (configured?.colorLight || configured?.colorDark) {
    const dark = c.bg === darkPalette.bg
    return dark
      ? configured.colorDark ?? configured.colorLight ?? c.prussian
      : configured.colorLight ?? configured.colorDark ?? c.prussian
  }

  switch (key) {
    case 'blackink': return c.domBlackink
    case 'atlas':    return c.domAtlas
    case 'saude':    return c.domSaude
    case 'financas': return c.domFinancas
    case 'outro':    return c.domOutro
    default:         return c.prussian
  }
}

export function normalizeDomainFromApi(input: Record<string, unknown>): Domain | null {
  const key = typeof input.slug === 'string' ? input.slug : typeof input.key === 'string' ? input.key : null
  const label = typeof input.label === 'string' ? input.label : key
  if (!key || !label) return null

  return {
    key,
    label,
    description: typeof input.description === 'string' ? input.description : null,
    colorLight: typeof input.color_light === 'string' ? input.color_light : null,
    colorDark: typeof input.color_dark === 'string' ? input.color_dark : null,
    defaultSensitivity: typeof input.default_sensitivity === 'string' ? input.default_sensitivity : null,
    externalAiPolicy: typeof input.external_ai_policy === 'string' ? input.external_ai_policy : null,
    active: typeof input.active === 'boolean' ? input.active : true,
    sortOrder: typeof input.sort_order === 'number' ? input.sort_order : 100,
  }
}

export function mergeDomains(domains: Domain[]): Domain[] {
  const byKey = new Map(DEFAULT_DOMAINS.map((domain) => [domain.key, domain]))
  for (const domain of domains) {
    byKey.set(domain.key, { ...(byKey.get(domain.key) ?? {}), ...domain })
  }

  return Array.from(byKey.values())
    .filter((domain) => domain.active !== false)
    .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.label.localeCompare(b.label))
}
