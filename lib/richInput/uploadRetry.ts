/**
 * Atlas Rich Input · upload retry helper (mobile re-export from canon).
 *
 * Implementation lives in `packages/atlas-rich-input-canon`. This thin
 * re-export keeps existing mobile import paths stable
 * (`from './uploadRetry'`).
 */
export type { RetryOptions } from '@atlas/rich-input-canon'
export { withRetry } from '@atlas/rich-input-canon'
