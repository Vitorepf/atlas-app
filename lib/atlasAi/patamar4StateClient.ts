/**
 * Atlas Patamar 4 · Mobile · HTTP client (silent).
 *
 *   GET /atlas/patamar4/state?tail=N (schema `atlas.patamar4.state.v1`)
 *
 * Silent: erro/404/timeout → null. Surface não exibe o painel.
 */
import { apiGet } from '../api/client'
import type { RawPatamar4State } from './patamar4State'

export async function getAtlasPatamar4State(tail = 5): Promise<RawPatamar4State | null> {
  try {
    const t = Math.max(1, Math.min(50, tail))
    return await apiGet<RawPatamar4State>(`/atlas/patamar4/state?tail=${t}`, { auth: false })
  } catch {
    return null
  }
}
