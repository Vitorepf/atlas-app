// Atlas mobile · metro config.
//
// Extends the Expo defaults so Metro can resolve the shared
// `@atlas/rich-input-canon` package (declared as a `file:` dep in
// package.json, symlinked at node_modules/@atlas/rich-input-canon to
// /Users/vitorepf/develop/Atlas/packages/atlas-rich-input-canon).
//
// Two flags are mandatory for the resolution to work:
//   1. `resolver.unstable_enableSymlinks` — Metro must follow the npm
//      file: symlink out of node_modules into the shared packages dir.
//      Without this, requiring `@atlas/rich-input-canon` fails with
//      "could not be found within the project or in these directories".
//   2. `watchFolders` — adds the shared packages dir to Metro's watch
//      graph so HMR + bundling see changes inside the canon.
//
// After editing this file you MUST restart Metro with `--clear`:
//   `npx expo start --clear` (or `npm start -- --clear`).
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '..')
const sharedPackagesRoot = path.resolve(monorepoRoot, 'packages')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [sharedPackagesRoot]

config.resolver = config.resolver ?? {}
config.resolver.unstable_enableSymlinks = true
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  sharedPackagesRoot,
]
// Canon source is `.ts` (no build step) — ensure Metro accepts the
// extensions when entering shared packages.
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts ?? []), 'ts', 'tsx']),
)

module.exports = config
