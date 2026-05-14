let registered = false
declare const require: (moduleName: string) => unknown

export function ensureLiveKitGlobals(): void {
  if (registered) return
  try {
    // LiveKit depends on native WebRTC modules. In an old Expo Go/dev-client
    // binary the native module may not exist yet; do not crash app startup.
    const livekit = require('@livekit/react-native') as { registerGlobals?: () => void }
    livekit.registerGlobals?.()
    registered = true
  } catch {
    registered = false
  }
}
