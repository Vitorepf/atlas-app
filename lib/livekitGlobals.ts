let registered = false
declare const require: (moduleName: string) => unknown
declare const global: {
  navigator?: { mediaDevices?: unknown }
  RTCPeerConnection?: unknown
  RTCSessionDescription?: unknown
  RTCIceCandidate?: unknown
}

export function hasLiveKitWebRtcGlobals(): boolean {
  return Boolean(
    global.navigator?.mediaDevices
      && global.RTCPeerConnection
      && global.RTCSessionDescription
      && global.RTCIceCandidate,
  )
}

export function ensureLiveKitGlobals(): boolean {
  if (registered && hasLiveKitWebRtcGlobals()) return true

  try {
    // LiveKit depends on native WebRTC globals before Room connects.
    const livekit = require('@livekit/react-native') as { registerGlobals?: () => void }
    livekit.registerGlobals?.()
  } catch {
    try {
      const webrtc = require('@livekit/react-native-webrtc') as { registerGlobals?: () => void }
      webrtc.registerGlobals?.()
    } catch {
      registered = false
      return false
    }
  }

  registered = hasLiveKitWebRtcGlobals()
  return registered
}

ensureLiveKitGlobals()
