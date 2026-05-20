/**
 * Atlas AI · Mobile · Runtime Readiness HTTP client (silent).
 *
 *   GET /atlas/ai/runtime-readiness (schema `atlas.ai.runtime_readiness.v1`)
 *
 * Filosofia silent: erro/404/timeout → null. UI apenas não exibe o bloco
 * "Atlas Runtime" no ContextSheet. Nunca propaga error para a conversação.
 *
 * Separado de `runtimeReadiness.ts` (view-model puro) porque este arquivo
 * arrasta `lib/api/client` que contém código React Native — evita travar
 * testes via `tsx` puro.
 */
import { apiGet } from '../api/client'
import type { AtlasAiRuntimeReadiness } from './runtimeReadiness'

export async function getAtlasAiRuntimeReadiness(): Promise<AtlasAiRuntimeReadiness | null> {
  try {
    return await apiGet<AtlasAiRuntimeReadiness>('/atlas/ai/runtime-readiness', { auth: false })
  } catch {
    return null
  }
}
