import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { displayText, displayTextList } from '../components/cartografia/state/cartografiaText'

const liveDataSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'state', 'useCartografiaLiveData.ts'),
  'utf8',
)
const screenSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'CartografiaScreen.tsx'),
  'utf8',
)
const assemblerSource = readFileSync(
  join(process.cwd(), '..', 'atlas-server', 'app', 'Services', 'Vault', 'GraphAssembler.php'),
  'utf8',
)

assert.equal(displayText(null), null)
assert.equal(displayText('  Atlas Decide  '), 'Atlas Decide')
assert.equal(displayText(25), '25')
assert.equal(displayText({ unsafe: 'object' }), null)
assert.equal(
  displayText([
    'docs/engineering-knowledge-base/system-graph/atlas-decide.md',
    'docs/engineering-knowledge-base/atlas-ai-model-selection-strategy.md',
  ]),
  'docs/engineering-knowledge-base/system-graph/atlas-decide.md · docs/engineering-knowledge-base/atlas-ai-model-selection-strategy.md',
)
assert.equal(displayText(['', '  ', 'Quality Gates']), 'Quality Gates')
assert.deepEqual(displayTextList(['  A  ', null, false, { nope: true }, 'B']), ['A', 'false', 'B'])

for (const frontmatterField of [
  'patamar_current',
  'patamar_next_of',
  'patamar_next',
  'patamar_after',
  'version_family',
  'versions',
  'version_note',
  'schema_version',
]) {
  assert.match(
    liveDataSource,
    new RegExp(frontmatterField),
    `Live cartography types must preserve canonical nomenclature field [${frontmatterField}]`,
  )
}

for (const awisReplayContract of [
  /runtime_projection_replay/,
  /artifact_graph_replay/,
  /artifact_lake_replay/,
  /RuntimeProjectionReplay/,
  /ArtifactGraphReplay/,
  /ArtifactLakeReplay/,
  /setRuntimeProjectionReplay/,
  /setArtifactGraphReplay/,
  /setArtifactLakeReplay/,
]) {
  assert.match(
    liveDataSource,
    awisReplayContract,
    `Mobile Cartografia live data must preserve AWIS runtime projection replay [${awisReplayContract.source}]`,
  )
}

for (const awisReplayVisual of [
  /AWIS STALE/,
  /awisReplayBadge/,
  /staleReplayFamilies/,
  /hasArtifactGraphStaleReplay/,
  /AWIS PACK/,
  /AWIS_ARTIFACT_GRAPH_IDS/,
  /atlas-workspace-intelligence-system/,
  /atlas-workspace-artifact-intelligence-runtime/,
  /artifactLakeReplayLabel/,
]) {
  assert.match(
    screenSource,
    awisReplayVisual,
    `CartografiaScreen must expose stale AWIS projection as a compact visual signal [${awisReplayVisual.source}]`,
  )
}

for (const adaptedField of [
  'patamarCurrent',
  'patamarNextOf',
  'patamarNext',
  'patamarAfter',
  'versionFamily',
  'versions',
  'versionNote',
  'schemaVersion',
]) {
  assert.match(
    liveDataSource,
    new RegExp(adaptedField),
    `Adapted mobile graph models must keep nomenclature field [${adaptedField}]`,
  )
  assert.match(
    screenSource,
    new RegExp(adaptedField),
    `CartografiaScreen must pass nomenclature field to the modal [${adaptedField}]`,
  )
}

for (const mapping of [
  /frontmatter_id\?: string \| null/,
  /graphId: node\.frontmatter_id \?\? node\.graph_id/,
  /visualGraphId: node\.graph_id/,
  /patamarCurrent: live\.patamar_current/,
  /patamarNextOf: live\.patamar_next_of/,
  /patamarNext: live\.patamar_next/,
  /patamarAfter: live\.patamar_after/,
  /versionFamily: live\.version_family/,
  /versions: live\.versions/,
  /versionNote: live\.version_note/,
  /schemaVersion: live\.schema_version/,
  /patamarCurrent: lane\.patamar_current/,
  /patamarNextOf: lane\.patamar_next_of/,
  /patamarNext: lane\.patamar_next/,
  /patamarAfter: lane\.patamar_after/,
  /versionFamily: lane\.version_family/,
  /patamarCurrent: node\.patamar_current/,
  /patamarNextOf: node\.patamar_next_of/,
  /patamarNext: node\.patamar_next/,
  /patamarAfter: node\.patamar_after/,
  /versionFamily: node\.version_family/,
]) {
  assert.match(
    liveDataSource,
    mapping,
    `Live graph adapter must not drop or rename nomenclature data incorrectly [${mapping.source}]`,
  )
}

for (const screenMapping of [
  /patamarCurrent: semanticNode\?\.patamar_current \?\? source\.patamarCurrent/,
  /patamarNextOf: semanticNode\?\.patamar_next_of \?\? source\.patamarNextOf/,
  /patamarNext: semanticNode\?\.patamar_next \?\? source\.patamarNext/,
  /patamarAfter: semanticNode\?\.patamar_after \?\? source\.patamarAfter/,
  /versionFamily: semanticNode\?\.version_family \?\? source\.versionFamily/,
  /versions: semanticNode\?\.versions \?\? source\.versions/,
  /versionNote: semanticNode\?\.version_note \?\? source\.versionNote/,
  /schemaVersion: semanticNode\?\.schema_version \?\? source\.schemaVersion/,
  /patamarCurrent: semanticNode\.patamar_current/,
  /patamarNextOf: semanticNode\.patamar_next_of/,
  /patamarNext: semanticNode\.patamar_next/,
  /patamarAfter: semanticNode\.patamar_after/,
  /versionFamily: semanticNode\.version_family/,
  /versions: semanticNode\.versions/,
  /versionNote: semanticNode\.version_note/,
  /schemaVersion: semanticNode\.schema_version/,
  /patamarCurrent: adaptedLane\.patamarCurrent/,
  /patamarNextOf: adaptedLane\.patamarNextOf/,
  /patamarNext: adaptedLane\.patamarNext/,
  /patamarAfter: adaptedLane\.patamarAfter/,
  /versionFamily: adaptedLane\.versionFamily/,
  /versions: adaptedLane\.versions/,
  /versionNote: adaptedLane\.versionNote/,
  /patamarCurrent: laneNode\.patamarCurrent/,
  /patamarNextOf: laneNode\.patamarNextOf/,
  /patamarNext: laneNode\.patamarNext/,
  /patamarAfter: laneNode\.patamarAfter/,
  /versionFamily: laneNode\.versionFamily/,
  /versions: laneNode\.versions/,
  /versionNote: laneNode\.versionNote/,
]) {
  assert.match(
    screenSource,
    screenMapping,
    `CartografiaScreen must preserve nomenclature fields for modal documentation [${screenMapping.source}]`,
  )
}

for (const backendField of [
  "'patamar_current' => $fm['patamar_current'] ?? null",
  "'patamar_next_of' => $fm['patamar_next_of'] ?? null",
  "'patamar_next' => $fm['patamar_next'] ?? null",
  "'version_family' => $fm['version_family'] ?? null",
  "'version_note' => $fm['version_note'] ?? null",
  "'schema_version' => $fm['schema_version'] ?? null",
]) {
  const occurrences = assemblerSource.split(backendField).length - 1
  assert.equal(
    occurrences,
    2,
    `GraphAssembler must expose [${backendField}] both in pipeline/lane atoms and semantic nodes`,
  )
}

assert.equal(
  assemblerSource.split("'patamar_after' => $this->listStrings($fm['patamar_after'] ?? [])").length - 1,
  2,
  'GraphAssembler must expose patamar_after both in pipeline/lane atoms and semantic nodes',
)
assert.equal(
  assemblerSource.split("'versions' => $this->listStrings($fm['versions'] ?? [])").length - 1,
  2,
  'GraphAssembler must expose versions both in pipeline/lane atoms and semantic nodes',
)

for (const humanClaritySurface of [
  /humanNextMove/,
  /sceneHint/,
]) {
  assert.match(
    screenSource,
    humanClaritySurface,
    `CartografiaScreen must expose human clarity guidance without adding a large blocking overlay [${humanClaritySurface.source}]`,
  )
}

assert.doesNotMatch(
  screenSource,
  /CLAREZA HUMANA/,
  'CartografiaScreen must not render a large duplicated human clarity card over the canvas',
)

console.log('cartografia live data contract tests passed')
