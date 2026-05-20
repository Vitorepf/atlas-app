/**
 * Atlas Rich Input · URL detector (mobile re-export from canon).
 *
 * Implementation lives in `packages/atlas-rich-input-canon`. This thin
 * re-export keeps existing mobile import paths stable
 * (`from './urlDetector'`).
 */
export type {
  DetectedUrl,
  DetectedUrlKind,
  UrlMetadata,
} from '@atlas/rich-input-canon'
export { classifyUrl, extractUrls, fetchUrlMetadata } from '@atlas/rich-input-canon'
