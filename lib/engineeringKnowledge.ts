import type {
  AtlasEngineeringCodeAuditResponse,
  AtlasEngineeringCodeModuleSummary,
  AtlasEngineeringCodeSymbolSummary,
  AtlasEngineeringKnowledgeItemSummary,
} from './api/client'

type KnowledgeMeta = Pick<AtlasEngineeringKnowledgeItemSummary, 'category' | 'priority' | 'canonical_path'>
type CodeModuleMeta = Pick<AtlasEngineeringCodeModuleSummary, 'layer' | 'root_path' | 'file_count' | 'symbol_count'>
type CodeModuleCoverage = Pick<AtlasEngineeringCodeModuleSummary, 'docs_status' | 'route_count' | 'command_count' | 'test_count'>
type CodeSymbolMeta = Pick<AtlasEngineeringCodeSymbolSummary, 'symbol_type' | 'module_slug' | 'file_path' | 'line_start'>

export function engineeringKnowledgeMetaLine(item: KnowledgeMeta): string {
  return `${item.category} · p${item.priority} · ${item.canonical_path}`
}

export function engineeringKnowledgeValuesLine(values: string[] | null | undefined, fallback = '-'): string {
  const clean = Array.from(new Set((values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)))

  if (clean.length === 0) return fallback

  const visible = clean.slice(0, 3)
  const overflow = clean.length - visible.length

  return overflow > 0 ? `${visible.join(' · ')} +${overflow}` : visible.join(' · ')
}

export function engineeringKnowledgeBodyPreview(body: string | null | undefined, maxChars = 420): string {
  const clean = (body ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Sem excerpt detalhado.'
  if (clean.length <= maxChars) return clean

  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}

export function engineeringCodeModuleMetaLine(module: CodeModuleMeta): string {
  return `${module.layer} · ${module.root_path ?? '-'} · ${module.file_count} files · ${module.symbol_count} símbolos`
}

export function engineeringCodeModuleCoverageLine(module: CodeModuleCoverage): string {
  return `docs ${module.docs_status} · rotas ${module.route_count} · comandos ${module.command_count} · testes ${module.test_count}`
}

export function engineeringCodeSymbolMetaLine(symbol: CodeSymbolMeta): string {
  const location = symbol.line_start ? `${symbol.file_path}:${symbol.line_start}` : symbol.file_path
  return `${symbol.symbol_type} · ${symbol.module_slug ?? '-'} · ${location}`
}

export function engineeringCodeValuesLine(values: string[] | null | undefined, fallback = '-'): string {
  return engineeringKnowledgeValuesLine(values, fallback)
}

export function engineeringCodeAuditStatusLabel(audit: AtlasEngineeringCodeAuditResponse | null | undefined): string {
  if (!audit) return 'não auditado'
  if (audit.status === 'fresh') return 'fresh'
  if (audit.status === 'drift_detected') return 'drift'
  if (audit.status === 'empty_index') return 'índice vazio'

  return audit.status || 'desconhecido'
}

export function engineeringCodeAuditDriftLine(audit: AtlasEngineeringCodeAuditResponse | null | undefined): string {
  if (!audit) return 'sem auditoria local'

  const drift = audit.summary.drift
  const moduleDrift = drift.modules.missing_in_index + drift.modules.removed_from_workspace + drift.modules.changed
  const symbolDrift = drift.symbols.added + drift.symbols.removed
  const docLinkDrift = drift.doc_links.missing_targets + drift.doc_links.stale_target_hashes
  const mode = audit.dry_run && !audit.writes ? 'dry-run sem escrita' : 'execução com escrita'

  return `drift ${drift.total} · módulos ${moduleDrift} · símbolos ${symbolDrift} · doc links ${docLinkDrift} · ${mode}`
}
