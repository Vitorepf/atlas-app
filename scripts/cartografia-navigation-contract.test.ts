import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const screenSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'CartografiaScreen.tsx'),
  'utf8',
)

const helperIndex = screenSource.indexOf('const openLaneNodeVisual = useCallback')
const searchIndex = screenSource.indexOf('const onSearchHit = useCallback')

assert.ok(helperIndex > -1, 'CartografiaScreen must define openLaneNodeVisual')
assert.ok(searchIndex > -1, 'CartografiaScreen must define onSearchHit')
assert.ok(
  helperIndex < searchIndex,
  'openLaneNodeVisual must be initialized before onSearchHit uses it; otherwise the screen can crash during render',
)

assert.match(
  screenSource,
  /const docId = hit\.graphId \?\? hit\.id/,
  'Search navigation must use graphId as the real documentation identity when the visible UI id differs',
)

assert.match(
  screenSource,
  /hit\.kind === 'lane-node' && openLaneNodeVisual\(docId\)/,
  'Search hits for lane nodes must open their own visual flow using the real graph id instead of silently doing nothing',
)

assert.match(
  screenSource,
  /nodes\.set\(adapted\.graphId, adapted\)/,
  'Lane child lookup must index the real documentation graph id, not only the visual lane alias',
)

assert.match(
  screenSource,
  /nodes\.set\(adapted\.visualGraphId \?\? adapted\.id, adapted\)/,
  'Lane child lookup must also index the visual graph id so canvas taps keep working when the real doc id differs',
)

assert.match(
  screenSource,
  /semanticSubflowByGraphId\(docId\)/,
  'Search hits must open semantic visual flows by graphId so real documentation nodes do not break behind static UI ids',
)

assert.match(
  screenSource,
  /const semanticSubflow = semanticSubflowByGraphId\(laneNode\.graphId\)/,
  'Lane child taps must drill into the resolved canonical documentation flow, not a poor terminal wrapper around the lane alias',
)

assert.match(
  screenSource,
  /const semanticFlow = buildSemanticFlow\(graphId\)/,
  'Opening a visual subflow must resolve through the semantic graph first so target_graph_id links become real nested drilldowns',
)

assert.match(
  screenSource,
  /const flow = semanticFlow\.length\s*\?\s*semanticFlow\s*:\s*source\.gearFlow \?\? \[\]/,
  'CartografiaScreen must only use raw pipeline gearFlow after semantic resolution fails',
)

assert.match(
  screenSource,
  /infoFromSemanticId\(node\.target_graph_id \?\? node\.graph_id\)/,
  'Long-press on a visual gear with target_graph_id must open the canonical node documentation, not the synthetic visual wrapper',
)

assert.match(
  screenSource,
  /infoFromSemanticId\(laneNode\?\.graphId \?\? id\)/,
  'Long-press on lane children must open the resolved canonical documentation from frontmatter_id when available',
)

assert.match(
  screenSource,
  /s\.id === hit\.id \|\| \('graphId' in s && s\.graphId === docId\)/,
  'Pipeline search hits must find the live step by UI id or graphId so canonical documentation identity wins when available',
)

const gearFlowSceneSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'scenes', 'GearFlowScene.tsx'),
  'utf8',
)
const laneRegionSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'map', 'LaneRegion.tsx'),
  'utf8',
)
const flowTrailsSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'map', 'FlowTrails.tsx'),
  'utf8',
)
const searchOverlaySource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'focus', 'SearchOverlay.tsx'),
  'utf8',
)
const searchOverlayModelSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'focus', 'SearchOverlayModel.ts'),
  'utf8',
)
const continentNodesSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'map', 'continentNodes.ts'),
  'utf8',
)
const universeSceneSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'scenes', 'UniverseScene.tsx'),
  'utf8',
)
const continentRadialSceneSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'scenes', 'ContinentRadialScene.tsx'),
  'utf8',
)
const visualSubflowSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'state', 'cartografiaVisualSubflow.ts'),
  'utf8',
)

assert.match(
  screenSource,
  /hit\.kind === 'semantic'/,
  'Search hits from the live semantic graph must open as visual flows, not as dead text results',
)

assert.match(
  screenSource,
  /semanticGraph=\{liveData\.semanticGraph\}/,
  'SearchOverlay must receive the live semantic graph so real docs such as Atlas Vox and Voice Realtime are discoverable',
)

assert.match(
  searchOverlayModelSource,
  /semanticGraph\?\.nodes\.forEach/,
  'SearchOverlay must index semantic_graph.nodes, not just static pipeline and mock continent nodes',
)

assert.match(
  searchOverlayModelSource,
  /kind: 'semantic'/,
  'SearchOverlay must tag real documentation hits as semantic hits for visual drilldown',
)

assert.match(
  searchOverlaySource,
  /numberOfLines=\{2\}>\s*\{hit\.name\}/,
  'SearchOverlay result titles must have at least two lines so documentation names are not hidden',
)

assert.match(
  searchOverlaySource,
  /numberOfLines=\{2\}>\s*\{hit\.subtitle\}/,
  'SearchOverlay result summaries must have at least two lines so documentation context is not hidden',
)

assert.match(
  searchOverlaySource,
  /DIGITE PARA BUSCAR TUDO/,
  'SearchOverlay must be honest when the initial list is truncated; it cannot label a 60-row preview as all documentation',
)

assert.match(
  searchOverlaySource,
  /const isTruncated =/,
  'SearchOverlay must explicitly compute truncation so documentation coverage is not misrepresented',
)

assert.match(
  searchOverlayModelSource,
  /export function buildCoverageGroups/,
  'SearchOverlay must build a coverage map so semantic-only documentation is visible as graph coverage, not hidden behind search mechanics',
)

assert.match(
  searchOverlaySource,
  /MAPA DE COBERTURA DOCUMENTAL/,
  'SearchOverlay must show a visual coverage map before the truncated result list',
)

assert.match(
  searchOverlaySource,
  /semanticOnlyCount/,
  'SearchOverlay must show how many docs are graph-only so the user understands what is visual on canvas versus reachable through the live graph',
)

assert.match(
  searchOverlaySource,
  /onSelectSection=\{setQuery\}/,
  'SearchOverlay coverage groups must be navigable filters, not decorative counters',
)

assert.match(
  continentNodesSource,
  /graphId: 'atlas-vox-operational-thinking-interface'/,
  'The visible Atlas Vox node must point to the real Atlas Vox documentation graph id',
)

assert.match(
  continentNodesSource,
  /graphId: 'atlas-ai-voice-realtime-surface'/,
  'The visible Voice Realtime node must point to the real technical voice surface graph id, separate from Atlas Vox',
)

assert.match(
  gearFlowSceneSource,
  /TOQUE · ABRE FLUXO/,
  'GearFlowScene must visually mark nodes that can drill into another flow',
)

assert.match(
  gearFlowSceneSource,
  /nodeAffordances/,
  'GearFlowScene nodes must include compact visual affordances for tap-to-flow and hold-for-docs',
)

assert.match(
  gearFlowSceneSource,
  /TERMINAL/,
  'GearFlowScene must visually mark terminal/documented nodes instead of pretending every node has an internal flow',
)

assert.match(
  gearFlowSceneSource,
  /LACUNA DOCUMENTAL/,
  'GearFlowScene must explicitly distinguish missing internal-flow documentation from normal terminal nodes',
)

assert.match(
  gearFlowSceneSource,
  /TERMINAIS DOCUMENTADOS/,
  'GearFlowScene must summarize terminal documented nodes so the operator knows the flow did not disappear',
)

assert.match(
  gearFlowSceneSource,
  /isDocumentationGap/,
  'GearFlowScene must classify documentation gaps deliberately instead of coloring every terminal/failure the same way',
)

assert.match(
  gearFlowSceneSource,
  /const failures = useMemo\(\(\) => active\.flow\.filter\(\(node\) => node\.kind === 'failure'\), \[active\.flow\]\)/,
  'GearFlowScene must collect every failure/documentation gap; using only the first one hides truth from the visual map',
)

assert.doesNotMatch(
  gearFlowSceneSource,
  /active\.flow\.find\(\(node\) => node\.kind === 'failure'\)/,
  'GearFlowScene must not use find() for failures because the documentation can expose multiple missing pieces',
)

assert.match(
  gearFlowSceneSource,
  /failures\.map\(\(failureNode, index\) =>/,
  'GearFlowScene must render every failure/documentation gap as its own visual component',
)

assert.match(
  gearFlowSceneSource,
  /const canonicalTarget = node\.target_graph_id \?\? node\.graph_id/,
  'Terminal visual flows must preserve the canonical target graph id for long-press documentation',
)

assert.match(
  gearFlowSceneSource,
  /target_graph_id: canonicalTarget/,
  'Every terminal synthetic visual piece must point long-press back to the canonical documentation node',
)

assert.match(
  visualSubflowSource,
  /function documentedTerminalFlow/,
  'Semantic nodes without explicit gear_flow must still create documented terminal visual flows, not blank screens',
)

assert.match(
  visualSubflowSource,
  /target_graph_id: node\.graph_id/,
  'Documented terminal visual pieces from semantic docs must point long-press back to the canonical node',
)

assert.match(
  visualSubflowSource,
  /target_graph_id: input\.graphId/,
  'Pipeline terminal visual pieces must point long-press back to their canonical pipeline graph id',
)

assert.match(
  gearFlowSceneSource,
  /onParentLongPress/,
  'GearFlowScene parent kernel must also expose long-press documentation; every visual component needs an explanation path',
)

assert.match(
  gearFlowSceneSource,
  /type FlowStackEntry/,
  'GearFlowScene must keep the active drilled node in the stack so long-press docs describe the current flow, not the parent canvas',
)

assert.match(
  gearFlowSceneSource,
  /setStack\(\[\{ title: parentStep\.name, flow: gearFlow \}\]\)/,
  'GearFlowScene must reset its internal drill stack when the parent visual flow changes; stale nested flows cannot leak into another gear',
)

assert.match(
  gearFlowSceneSource,
  /function FlowTrail/,
  'GearFlowScene must render a compact visual trail so recursive drilldown levels are visible without text sheets',
)

assert.match(
  gearFlowSceneSource,
  /flowTrailChip/,
  'GearFlowScene flow trail must use visual chips for drilldown levels',
)

assert.match(
  gearFlowSceneSource,
  /node\?: LiveGearFlowNode/,
  'GearFlowScene stack entries must carry the active node identity for nested documentation modals',
)

assert.match(
  gearFlowSceneSource,
  /onParentLongPress\?: \(activeNode\?: LiveGearFlowNode\) => void/,
  'GearFlowScene parent long-press must receive the active drilled node when the user is inside an internal flow',
)

assert.match(
  gearFlowSceneSource,
  /onLongPress=\{\(\) => onParentLongPress\?\.\(active\.node\)\}/,
  'GearFlowScene kernel long-press must open documentation for the active subflow node instead of always opening the original parent',
)

assert.match(
  screenSource,
  /onParentLongPress=\{\(activeNode\) =>/,
  'CartografiaScreen must handle nested parent long-press from GearFlowScene',
)

assert.match(
  screenSource,
  /if \(activeNode\) \{\s*openGearInfo\(infoFromGearNode\(activeNode\)\)/,
  'CartografiaScreen must open the nested active node documentation when a drilled gear flow is long-pressed',
)

assert.match(
  gearFlowSceneSource,
  /FLUXO VISUAL · NIVEL/,
  'GearFlowScene must show the current visual drilldown level so nested flows do not feel like an overlay on the old canvas',
)

assert.match(
  gearFlowSceneSource,
  /<Polygon/,
  'GearFlowScene must render directional arrowheads so the flow order is visible',
)

assert.match(
  flowTrailsSource,
  /id="tip-loop"/,
  'FlowTrails feedback loops must have their own directional marker; loops without direction look like decoration',
)

assert.match(
  flowTrailsSource,
  /markerEnd="url\(#tip-loop\)"/,
  'FlowTrails feedback arcs must render arrowheads so return paths are visually readable',
)

assert.doesNotMatch(
  gearFlowSceneSource,
  /node\.name\}\s*<\/Frau>[\s\S]{0,160}numberOfLines=\{1\}/,
  'GearFlowScene must not compress node names to one line; visual docs need enough text to identify the component',
)

assert.match(
  gearFlowSceneSource,
  /PIPELINE_STEP_HEIGHT \+ 18/,
  'GearFlowScene cards must reserve stable height for readable two-line names and summaries',
)

const flowSceneSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'scenes', 'FlowScene.tsx'),
  'utf8',
)

assert.match(
  flowSceneSource,
  /FLUXO-MAE/,
  'FlowScene must expose a visible parent component for the main Atlas AI Kernel pipeline',
)

assert.doesNotMatch(
  flowSceneSource,
  /numberOfLines=\{1\}/,
  'FlowScene must not hide the main flow label/deck in one-line clamps',
)

const pipelineAtomSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'map', 'PipelineAtom.tsx'),
  'utf8',
)

assert.match(
  pipelineAtomSource,
  /numberOfLines=\{2\}/,
  'PipelineAtom must allow two-line deck summaries so the main Atlas flow remains understandable',
)

assert.match(
  pipelineAtomSource,
  /affordanceRail/,
  'PipelineAtom must visually signal tap-to-flow and long-press documentation without relying on hidden behavior',
)

assert.match(
  flowSceneSource,
  /onFlowLongPress/,
  'The main pipeline parent component must support long press documentation like every other visual component',
)

assert.match(
  screenSource,
  /ATLAS_FLOW_FOCUS/,
  'Entering Atlas must focus the camera on the readable pipeline, not fit the whole empty world',
)

assert.match(
  screenSource,
  /function subflowFocusRectForCount/,
  'Opening a gear must compute a dynamic focus rect so tall internal flows are readable instead of clipped or tiny',
)

assert.match(
  screenSource,
  /function focusSubflow/,
  'Opening a gear must use a dedicated focus helper for the internal visual flow',
)

assert.doesNotMatch(
  screenSource,
  /const SUBFLOW_FOCUS/,
  'Subflow navigation must not use one stale fixed focus rectangle for every gear; it clips short/tall flows differently',
)

assert.match(
  screenSource,
  /x: 180,[\s\S]{0,80}w: 2000,[\s\S]{0,80}h: 2000/,
  'Atlas flow focus must include the lateral lane cards, not only the central pipeline',
)

assert.match(
  screenSource,
  /focusSubflow\(viewport,/,
  'Every subflow navigation path must call the dynamic subflow focus helper',
)

assert.match(
  screenSource,
  /const onSubflowActiveCountChange = useCallback/,
  'Nested visual drilldowns must refocus the camera when the active internal flow count changes',
)

assert.match(
  screenSource,
  /onActiveCountChange=\{onSubflowActiveCountChange\}/,
  'GearFlowScene must report nested drilldown count through the camera-refocus handler, not raw setState only',
)

assert.doesNotMatch(
  screenSource,
  /onActiveCountChange=\{setSubflowCount\}/,
  'Nested drilldown cannot only update the footer count; it must refocus the visual flow too',
)

for (const contract of [
  'type GearInfoState',
  'const openGearInfo = useCallback',
  'activeSteps.map((item) => infoFromStep',
  'sequence.map(infoFromGearNode)',
  'hasPrevious={Boolean(gearInfoState && gearInfoState.index > 0)}',
  'hasNext={Boolean(gearInfoState && gearInfoState.index < gearInfoState.items.length - 1)}',
  'index: Math.max(0, current.index - 1)',
  'index: Math.min(current.items.length - 1, current.index + 1)',
]) {
  assert.match(
    screenSource,
    new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `CartografiaScreen must keep modal gear sequence navigation contract [${contract}]`,
  )
}

assert.doesNotMatch(
  screenSource,
  /nav\.enterSubflow\([^)]*\)\s*\n\s*setTimeout\(\(\) => viewport\.fit\(\)/,
  'Subflow navigation must not use viewport.fit(); it makes the internal flow tiny and hard to read',
)

assert.match(
  laneRegionSource,
  /const dynamicHeight = Math\.max/,
  'LaneRegion must size itself from live node content instead of clipping dynamic documentation pieces',
)

assert.match(
  laneRegionSource,
  /onLaneLongPress/,
  'LaneRegion parent cards must support long press; lane documentation cannot be hidden behind child nodes only',
)

assert.match(
  laneRegionSource,
  /regionLongPressSurface/,
  'LaneRegion must expose a whole-card long-press surface so parent lane docs are reachable outside the small header',
)

assert.match(
  laneRegionSource,
  /headAffordances/,
  'LaneRegion parent cards must visually signal that the lane itself has documentation on long press',
)

assert.match(
  laneRegionSource,
  /flowPort/,
  'LaneRegion parent cards must expose a visual connection port so the user can see where the lane connects',
)

assert.match(
  laneRegionSource,
  /microRoute/,
  'LaneRegion target badges must include a compact visual route, not only text, to clarify source-to-target direction',
)

assert.match(
  laneRegionSource,
  /nodeAffordances/,
  'LaneRegion child nodes must visually signal tap-to-flow and long-press documentation',
)

assert.match(
  screenSource,
  /const infoFromLane = useCallback/,
  'CartografiaScreen must build modal documentation for lane parent components such as Domain Plane and Capabilities / Harnesses',
)

assert.match(
  screenSource,
  /onLaneLongPress=\{onLaneLongPress\}/,
  'FlowScene must receive lane parent long-press handling from CartografiaScreen',
)

assert.match(
  screenSource,
  /const infoFromContinent = useCallback/,
  'CartografiaScreen must build modal documentation for universe continent parent components too',
)

assert.doesNotMatch(
  screenSource,
  /<ContinentPeek/,
  'Long-press on universe components must open the same documentation modal, not a separate textual peek surface',
)

assert.match(
  screenSource,
  /onCenterLongPress=\{onContinentLongPress\}/,
  'Continent radial scenes must expose documentation from the central parent component, not only orbit nodes',
)

for (const radialVisualCue of [
  /TOQUE · ABRE FLUXO/,
  /TOQUE · LOCALIZA/,
  /centerAffordance/,
  /nodeAffordances/,
]) {
  assert.match(
    continentRadialSceneSource,
    radialVisualCue,
    `ContinentRadialScene must visually signal tap-to-flow and hold-for-docs on continent components [${radialVisualCue.source}]`,
  )
}

for (const universalLongPressContract of [
  {
    source: universeSceneSource,
    pattern: /onContinentLongPress\?: \(id: string\) => void/,
    message: 'UniverseScene must expose long press docs for every continent parent node',
  },
  {
    source: universeSceneSource,
    pattern: /onLongPress=\{onContinentLongPress\}/,
    message: 'UniverseScene must pass long press docs into ContinentAtom, not only tap navigation',
  },
  {
    source: continentRadialSceneSource,
    pattern: /onCenterLongPress\?: \(id: string\) => void/,
    message: 'ContinentRadialScene must expose long press docs for the central parent component',
  },
  {
    source: continentRadialSceneSource,
    pattern: /onNodeLongPress\?: \(id: string\) => void/,
    message: 'ContinentRadialScene must expose long press docs for orbit child nodes',
  },
  {
    source: continentRadialSceneSource,
    pattern: /onLongPress=\{onCenterLongPress \? \(\) => onCenterLongPress\(continentId\) : undefined\}/,
    message: 'The central continent glyph must open its own documentation modal on long press',
  },
  {
    source: continentRadialSceneSource,
    pattern: /onLongPress=\{onNodeLongPress\}/,
    message: 'Orbit nodes must receive long press docs, not only visual drilldown taps',
  },
  {
    source: flowSceneSource,
    pattern: /onLaneLongPress\?: \(id: string\) => void/,
    message: 'FlowScene must expose long press docs for lane parent components',
  },
  {
    source: flowSceneSource,
    pattern: /onLaneNodeLongPress\?: \(id: string\) => void/,
    message: 'FlowScene must expose long press docs for lane child components',
  },
  {
    source: flowSceneSource,
    pattern: /onLongPress=\{onFlowLongPress\}/,
    message: 'The Atlas AI Kernel parent flow component must open documentation on long press',
  },
  {
    source: flowSceneSource,
    pattern: /onLongPress=\{onStepLongPress\}/,
    message: 'Every pipeline step must receive long press documentation handling',
  },
  {
    source: gearFlowSceneSource,
    pattern: /onNodeLongPress\?: \(node: LiveGearFlowNode, sequence: LiveGearFlowNode\[\], index: number\) => void/,
    message: 'GearFlowScene must expose sequenced long press documentation for every internal gear',
  },
  {
    source: laneRegionSource,
    pattern: /onLaneLongPress\?: \(id: string\) => void/,
    message: 'LaneRegion must expose parent lane documentation on long press',
  },
  {
    source: laneRegionSource,
    pattern: /onNodeLongPress\?: \(id: string\) => void/,
    message: 'LaneRegion must expose lane child documentation on long press',
  },
]) {
  assert.match(
    universalLongPressContract.source,
    universalLongPressContract.pattern,
    universalLongPressContract.message,
  )
}

assert.match(
  laneRegionSource,
  /minHeight: dynamicHeight/,
  'LaneRegion must use minHeight so rendered content can grow instead of being clipped by a stale fixed height',
)

assert.doesNotMatch(
  laneRegionSource,
  /height: nodeHeight/,
  'LaneRegion nodes must not use a fixed height; long names such as Dynamic Compute Market must not be clipped',
)

assert.match(
  laneRegionSource,
  /minHeight: nodeMinHeight/,
  'LaneRegion child nodes must have a minimum height and be allowed to grow for readable documentation labels',
)

assert.match(
  laneRegionSource,
  /overflow: 'visible'/,
  'LaneRegion must not hide dynamic lane content; clipping hides documentation from the visual map',
)

assert.doesNotMatch(
  laneRegionSource,
  /numberOfLines=\{[123]\}/,
  'LaneRegion must not clamp lane titles, decks, target names, or node labels; clipping hides documentation from the visual map',
)

console.log('cartografia navigation contract tests passed')
