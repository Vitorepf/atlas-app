const fs = require('fs')
const path = require('path')

const appJson = require('./app.json')

function readEnvFile(filePath) {
  try {
    const contents = fs.readFileSync(filePath, 'utf8')
    return Object.fromEntries(
      contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=')
          const key = line.slice(0, index).trim()
          const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
          return [key, value]
        }),
    )
  } catch {
    return {}
  }
}

const atlasServerEnvPath = path.resolve(__dirname, '../atlas-server/.env')
const atlasServerEnv = readEnvFile(atlasServerEnvPath)
const atlasExtra = appJson.expo.extra?.atlas ?? {}

// Host/token/liveKitUrl no longer live in app.json (no committed infra IP or
// dev token). They come from env (dev-ios.sh sets ATLAS_API_HOST / LIVEKIT_URL)
// or ../atlas-server/.env (ATLAS_TOKEN). Warn loudly instead of falling back
// to the client.ts placeholders silently.
if (!(process.env.ATLAS_API_TOKEN ?? atlasServerEnv.ATLAS_TOKEN)) {
  console.warn(
    `[atlas] No ATLAS_API_TOKEN and no ATLAS_TOKEN in ${atlasServerEnvPath} — ` +
      'falling back to the placeholder dev token. Set one before building for a real device.',
  )
}
if (!process.env.ATLAS_API_HOST) {
  console.warn('[atlas] No ATLAS_API_HOST set — falling back to 127.0.0.1 (ok for simulator; set it for LAN/Tailscale).')
}

const expo = {
  ...appJson.expo,
  updates: {
    ...(appJson.expo.updates ?? {}),
    url: 'https://u.expo.dev/9fd23e13-65fd-4775-a72d-7b6ab9108769',
  },
  runtimeVersion: appJson.expo.runtimeVersion ?? {
    policy: 'appVersion',
  },
  extra: {
    ...(appJson.expo.extra ?? {}),
    atlas: {
      ...atlasExtra,
      apiHost: process.env.ATLAS_API_HOST ?? atlasExtra.apiHost,
      apiPort: Number(process.env.ATLAS_API_PORT ?? atlasExtra.apiPort ?? 3737),
      apiToken: process.env.ATLAS_API_TOKEN ?? atlasServerEnv.ATLAS_TOKEN ?? atlasExtra.apiToken,
      liveKitUrl: process.env.LIVEKIT_URL ?? process.env.ATLAS_LIVEKIT_URL ?? atlasExtra.liveKitUrl,
    },
  },
  plugins: [
    ...(appJson.expo.plugins ?? []),
    '@livekit/react-native-expo-plugin',
    'expo-background-task',
    // expo-notifications stays declared once in app.json (with its custom
    // atlas-bronze.wav sound); the bare re-append here was a dup that dropped
    // that config. See runbook E-D2.
  ],
}

module.exports = { expo }
