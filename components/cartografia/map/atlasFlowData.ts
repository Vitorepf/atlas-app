/**
 * Cartografia · dados canônicos do Atlas AI Kernel Pipeline.
 *
 * 17 etapas + 6 lanes laterais. Cada etapa pertence a uma fase canon
 * (intake/shape/decide/prove/render). A fase determina o glifo visual
 * — você vê o glifo e sabe o tipo de operação SEM ler.
 *
 * Coordenadas espelham `LAYOUT_ATLAS` do mockup AtlasVault (1880×1820).
 *
 * Fases canon:
 *   intake (i-iii)  · ↓  recebe operador
 *   shape  (iv-viii) · ◇  transforma contexto
 *   decide (ix-xii) · ✦  escolhe rumo
 *   prove  (xiii-xv) · ⊞  verifica resultado
 *   render (xvi-xvii) · →  entrega humano
 *
 * Quando o backend `/atlas-cartography/graph` entrar, este arquivo vira
 * fallback canon (offline) · data real do server tem precedência.
 */

export type FlowPhase = 'intake' | 'shape' | 'decide' | 'prove' | 'render'

export interface PipelineStep {
  /** numeral romano canônico */
  num: number
  /** identidade graph_id canon */
  id: string
  /** nome curto Frau italic */
  name: string
  /** deck italic regular · uma linha curta */
  deck: string
  phase: FlowPhase
  /** se for hero (Atlas Decide), recebe peso visual extra */
  hero?: boolean
  /** subcomponentes canon · revelados em zoom-close (canon AtlasVault) */
  subs?: ReadonlyArray<string>
}

export const PIPELINE_STEPS: ReadonlyArray<PipelineStep> = [
  { num: 1, id: 'pipe-1', name: 'Surface Plane',       deck: 'app · mobile · cli · api · mcp',     phase: 'intake',
    subs: ['App web', 'App mobile', 'CLI', 'API REST', 'MCP'] },
  { num: 2, id: 'pipe-2', name: 'Surface Adapter',     deck: 'coleta input, apresenta output, não decide', phase: 'intake',
    subs: ['Input', 'Output', 'No decision'] },
  { num: 3, id: 'pipe-3', name: 'Atlas Input',         deck: 'texto · imagem · áudio · arquivo · paste',   phase: 'intake',
    subs: ['Text', 'Image', 'Audio', 'File', 'Paste'] },
  { num: 4, id: 'pipe-4', name: 'Operation Envelope',  deck: 'unidade canônica · trace · tenant · origem', phase: 'shape',
    subs: ['Trace', 'Tenant', 'Origin'] },
  { num: 5, id: 'pipe-5', name: 'Intent / Routing',    deck: 'entende pedido · risco · tipo de tarefa',    phase: 'shape',
    subs: ['Intent', 'Risk', 'Task type'] },
  { num: 6, id: 'pipe-6', name: 'Business Context',    deck: 'objetivos · KPIs · domínio',         phase: 'shape',
    subs: ['KPIs', 'Goals', 'Domain'] },
  { num: 7, id: 'pipe-7', name: 'Domain / Profile / Flow', deck: 'domínio cognitivo + sistema vertical', phase: 'shape',
    subs: ['Domain', 'Profile', 'Flow'] },
  { num: 8, id: 'pipe-8', name: 'Context Builder',     deck: 'Open Brain · Memory · Engineering KB · Sync', phase: 'shape',
    subs: ['Open Brain', 'Memory', 'Engineering KB', 'Sync'] },
  { num: 9, id: 'pipe-9', name: 'Policy / Profile',    deck: 'permissão · privacidade · autonomia · custo', phase: 'decide',
    subs: ['Permission', 'Privacy', 'Autonomy', 'Cost'] },
  { num: 10, id: 'pipe-10', name: 'Atlas Decide',        deck: 'escolhe modelo · provider · budget · contrato', phase: 'decide', hero: true,
    subs: ['Intento + risco', 'Policy limits', 'Contexto + evidência', 'Provider topology', 'Budget + autonomia', 'Decision Receipt', 'Falha governada'] },
  { num: 11, id: 'pipe-11', name: 'Decision Receipt',    deck: 'contrato assinado · hash · dry-run · audit', phase: 'decide',
    subs: ['Contract', 'Hash', 'Dry-run', 'Audit'] },
  { num: 12, id: 'pipe-12', name: 'Runtime / Executor',  deck: 'executa via runtime · drivers · harnesses', phase: 'decide',
    subs: ['Runtime', 'Drivers', 'Harnesses'] },
  { num: 13, id: 'pipe-13', name: 'Quality Gates',       deck: 'segurança · testes · SLO · visual QA', phase: 'prove',
    subs: ['Security', 'Tests', 'SLO', 'Visual QA'] },
  { num: 14, id: 'pipe-14', name: 'Repair / Escalation', deck: 'corrige · reexecuta · escala ou bloqueia', phase: 'prove',
    subs: ['Repair', 'Rerun', 'Escalate', 'Block'] },
  { num: 15, id: 'pipe-15', name: 'Evidence Ledger',     deck: 'eventos append-only · replay · auditoria', phase: 'prove',
    subs: ['Events', 'Replay', 'Audit'] },
  { num: 16, id: 'pipe-16', name: 'Learning / Proposals', deck: 'memória · métricas · quality score · propostas', phase: 'render',
    subs: ['Memory', 'Metrics', 'Quality', 'Proposals'] },
  { num: 17, id: 'pipe-17', name: 'Output Renderer',     deck: 'resposta · patch · plano · proposta · briefing', phase: 'render',
    subs: ['Answer', 'Patch', 'Plan', 'Proposal', 'Briefing'] },
]

export interface LaneNode {
  id: string
  name: string
}

export interface LaneDef {
  id: string
  name: string
  deck: string
  /** posição canônica world-space */
  x: number
  y: number
  w: number
  h: number
  side: 'left' | 'right' | 'center'
  /** atoms internos da lane */
  nodes: ReadonlyArray<LaneNode>
  /** node-id pipeline pra onde a lane alimenta (feed trail) */
  feedsInto?: string
  /** se a relação é feedback (loop reverso) ao invés de feed */
  feedback?: boolean
}

export const LANE_DEFINITIONS: ReadonlyArray<LaneDef> = [
  {
    id: 'lane-domain',
    name: 'Domain Plane',
    deck: 'conecta domain/profile/flow',
    x: 280, y: 900, w: 360, h: 390,
    side: 'left',
    feedsInto: 'pipe-7',
    nodes: [
      { id: 'dom-prog',  name: 'Programming' },
      { id: 'dom-cyber', name: 'Cyber Security' },
      { id: 'dom-finance', name: 'Finance' },
      { id: 'dom-saude',  name: 'Saúde' },
      { id: 'dom-mkt',    name: 'Marketing' },
      { id: 'dom-strat',  name: 'Strategy' },
    ],
  },
  {
    id: 'lane-cap',
    name: 'Capabilities',
    deck: 'harnesses · MCP · tools',
    x: 280, y: 1620, w: 360, h: 330,
    side: 'left',
    feedsInto: 'pipe-12',
    nodes: [
      { id: 'cap-mcp',    name: 'MCP Servers' },
      { id: 'cap-cli',    name: 'CLI Harness' },
      { id: 'cap-pty',    name: 'PTY Runtime' },
      { id: 'cap-vox',    name: 'Vox Voice' },
      { id: 'cap-forge',  name: 'Forge Tools' },
    ],
  },
  {
    id: 'lane-biz',
    name: 'Business Context',
    deck: 'KPIs · objetivo da hora',
    x: 760, y: 1040, w: 300, h: 210,
    side: 'center',
    feedsInto: 'pipe-6',
    nodes: [
      { id: 'biz-kpi',  name: 'KPIs · OKRs' },
      { id: 'biz-goal', name: 'Objetivo da hora' },
    ],
  },
  {
    id: 'lane-hks',
    name: 'HKS Vault',
    deck: 'human knowledge surface',
    x: 1760, y: 860, w: 360, h: 300,
    side: 'right',
    feedsInto: 'pipe-8',
    nodes: [
      { id: 'hks-vault',     name: 'AtlasVault' },
      { id: 'hks-livros',    name: 'Livros · marginalia' },
      { id: 'hks-principios', name: 'Princípios' },
      { id: 'hks-historias', name: 'Histórias' },
    ],
  },
  {
    id: 'lane-evi',
    name: 'Evidence Loop',
    deck: 'fatos · receipts · provas',
    x: 1760, y: 1240, w: 360, h: 340,
    side: 'right',
    feedsInto: 'pipe-10',
    feedback: true,
    nodes: [
      { id: 'evi-ledger',    name: 'Receipt Ledger' },
      { id: 'evi-gates',     name: 'Gate Outcomes' },
      { id: 'evi-traces',    name: 'Execution Traces' },
      { id: 'evi-learning',  name: 'Learning Packets' },
    ],
  },
  {
    id: 'lane-doc',
    name: 'Documentation OS',
    deck: 'docs canônicos · governança',
    x: 1760, y: 1660, w: 360, h: 240,
    side: 'right',
    feedsInto: 'pipe-8',
    nodes: [
      { id: 'doc-eng',    name: 'Engineering KB' },
      { id: 'doc-adr',    name: 'ADRs vigentes' },
      { id: 'doc-canon',  name: 'Canon vivo' },
    ],
  },
]

/** Pipeline geometry canon · centralizado no mundo 2800×2600 */
export const PIPELINE_X = 1180
export const PIPELINE_Y = 480
export const PIPELINE_WIDTH = 440
export const PIPELINE_STEP_HEIGHT = 92
export const PIPELINE_HERO_EXTRA = 24

export function pipelineStepY(num: number): number {
  return pipelineStepYForSteps(num, PIPELINE_STEPS)
}

export function pipelineStepHeight(num: number): number {
  const step = PIPELINE_STEPS[num - 1]
  return pipelineStepHeightFor(step)
}

export function pipelineStepHeightFor(step?: Pick<PipelineStep, 'hero'> | null): number {
  return PIPELINE_STEP_HEIGHT + (step?.hero ? PIPELINE_HERO_EXTRA : 0)
}

export function pipelineStepYForSteps(
  num: number,
  steps: ReadonlyArray<Pick<PipelineStep, 'num' | 'hero'>> = PIPELINE_STEPS,
): number {
  let y = PIPELINE_Y
  const ordered = [...steps].sort((a, b) => a.num - b.num)
  for (const step of ordered) {
    if (step.num >= num) break
    y += pipelineStepHeightFor(step)
  }
  return y
}
