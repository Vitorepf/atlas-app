import type { AtlasPalette } from '../design/tokens'

export type DomainKey = 'blackink' | 'saude' | 'financas' | 'outro'

export interface Domain {
  key: DomainKey
  label: string
}

export const DOMAINS: Domain[] = [
  { key: 'blackink', label: 'BlackInk' },
  { key: 'saude',    label: 'Saúde' },
  { key: 'financas', label: 'Finanças' },
  { key: 'outro',    label: 'Outro' },
]

export function domainLabel(key: DomainKey): string {
  return DOMAINS.find((d) => d.key === key)?.label ?? key
}

export function domainColor(key: DomainKey, c: AtlasPalette): string {
  switch (key) {
    case 'blackink': return c.domBlackink
    case 'saude':    return c.domSaude
    case 'financas': return c.domFinancas
    case 'outro':    return c.domOutro
  }
}
