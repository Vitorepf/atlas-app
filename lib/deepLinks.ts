import { useCallback, useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useShell } from '../components/AtlasShell'
import { useOverlays } from './overlays'
import { routeAtlasDeepLink } from './atlasDeepLinkCore'
export { parseAtlasDeepLink, type AtlasDeepLink } from './atlasDeepLinkCore'

interface RouterLike {
  push: (href: any) => void
}

interface AtlasDeepLinkHandlers {
  openAtlasAi?: (threadId?: string | null) => void
}

export function openAtlasDeepLink(url: string, router: RouterLike, handlers: AtlasDeepLinkHandlers = {}): boolean {
  const route = routeAtlasDeepLink(url, { canOpenAtlasAi: handlers.openAtlasAi != null })
  if (!route) return false

  if (route.kind === 'atlas_ai') {
    handlers.openAtlasAi?.(route.threadId)
  } else {
    router.push(route.href)
  }

  return true
}

export function useAtlasDeepLinks(): void {
  const router = useRouter()
  const { showToast } = useShell()
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const open = useCallback((url: string) => {
    // Ignore non-Atlas URLs entirely (Expo dev tunnel boot URL, Expo Go
    // launch URL, OS background hand-off, etc.). Only treat malformed
    // atlas://... URLs as actual invalid links.
    if (!url.startsWith('atlas://')) return

    const handled = openAtlasDeepLink(url, router, { openAtlasAi })
    if (!handled) {
      router.push('/inbox')
      showToast('link invalido do Atlas', { durationMs: 2200 })
    }
  }, [openAtlasAi, router, showToast])

  useEffect(() => {
    let active = true
    void Linking.getInitialURL().then((url) => {
      if (active && url) open(url)
    })

    const subscription = Linking.addEventListener('url', ({ url }) => {
      open(url)
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [open])
}
