/**
 * Atlas AI · Mobile · canonical types.
 *
 * Espelha `atlas-desktop/apps/desktop/src/surfaces/atlas-ai/types.ts` com o
 * subset relevante pro mobile.
 *
 * **Hyperflow-first design.** Mobile é SURFACE Plane do Hyperflow — coleta
 * hint do operador (`mode`/`task`) e despacha pro backend Router Runtime.
 * A decisão canônica de domain/flow/runtime vive no `trace.hyperflow_runtime`
 * retornado pelo backend, NUNCA é inferida client-side como ground truth.
 *
 * Default canônico: `auto/auto`. Programming-specific runtime policy só entra
 * no payload quando `mode==='programming'` explícito.
 */

/**
 * 12 modos canônicos espelhados do desktop. `auto` é o default — o front
 * NÃO assume domínio.
 */
export type AtlasAiMode =
  | 'auto'
  | 'general'
  | 'conversation'
  | 'operational'
  | 'programming'
  | 'research'
  | 'finance'
  | 'marketing'
  | 'strategy'
  | 'personal_development'
  | 'cyber'
  | 'automation'

/** Tasks possíveis. `auto` é o default — backend escolhe via Hyperflow. */
export type AtlasAiTask = 'auto' | 'direct' | 'plan' | 'review' | 'dev' | 'debug'

/**
 * Provider concreto (após Atlas Decide ou override manual). `auto` NÃO entra
 * aqui — quando o operador deixa em auto, o campo `requested_provider` é
 * omitido do payload (backend escolhe).
 */
export type AtlasAiProvider = 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'

/**
 * Choice exposta no composer mobile (pill provider). Inclui `auto` para o
 * caso "deixa o Atlas decidir".
 */
export type AtlasAiProviderChoice = 'auto' | AtlasAiProvider

/**
 * Focus = Mode no contrato atual. Mantido como alias semântico
 * (espelha desktop) — alguns consumers querem o conceito de "foco" sem
 * acoplar à decisão de mode.
 */
export type AtlasAiFocus = AtlasAiMode
