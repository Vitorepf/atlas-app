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

const atlasServerEnv = readEnvFile(path.resolve(__dirname, '../atlas-server/.env'))
const atlasExtra = appJson.expo.extra?.atlas ?? {}

const expo = {
  ...appJson.expo,
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
    'expo-notifications',
  ],
}

module.exports = { expo }
