// Atlas mobile · metro config.
//
// Extends the Expo defaults for local monorepo development.
//
// In EAS Build, the app is archived as an isolated project. Sibling package
// folders may not exist there, so shared watch folders must only be added when
// present locally.
//
// After editing this file you MUST restart Metro with `--clear`:
//   `npx expo start --clear` (or `npm start -- --clear`).
const { getDefaultConfig } = require('expo/metro-config')
const fs = require('fs')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '..')
const sharedPackagesRoot = path.resolve(monorepoRoot, 'packages')

const config = getDefaultConfig(projectRoot)

const watchFolders = []
if (fs.existsSync(sharedPackagesRoot)) {
  watchFolders.push(sharedPackagesRoot)
}
config.watchFolders = watchFolders

config.resolver = config.resolver ?? {}
if (fs.existsSync(sharedPackagesRoot)) {
  config.resolver.unstable_enableSymlinks = true
}
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...(fs.existsSync(sharedPackagesRoot) ? [sharedPackagesRoot] : []),
]
// Canon source is `.ts` (no build step) — ensure Metro accepts the
// extensions when entering shared packages.
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts ?? []), 'ts', 'tsx']),
)

module.exports = config
