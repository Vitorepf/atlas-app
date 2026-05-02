import { useCallback, useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useShell } from '../components/AtlasShell'
import { useOverlays } from './overlays'

interface RouterLike {
  push: (href: any) => void
}

interface AtlasDeepLinkHandlers {
  openAtlasAi?: (threadId?: string | null) => void
}

export interface AtlasDeepLink {
  target: string
  id?: string
  action?: string
  params?: Record<string, string>
}

export function parseAtlasDeepLink(url: string): AtlasDeepLink | null {
  if (!url.startsWith('atlas://')) return null

  const withoutScheme = url.replace(/^atlas:\/\//, '')
  const query = withoutScheme.split('?')[1]?.split('#')[0] ?? ''
  const queryParams = Object.fromEntries(new URLSearchParams(query).entries())
  const queryAction = queryParams.action
  const clean = withoutScheme
    .split('?')[0]
    .split('#')[0]
    .replace(/^\/+/, '')
  const [target, id, action] = clean.split('/').filter(Boolean)
  if (!target) return null

  return { target, id, action: action ?? queryAction, params: queryParams }
}

export function openAtlasDeepLink(url: string, router: RouterLike, handlers: AtlasDeepLinkHandlers = {}): boolean {
  const parsed = parseAtlasDeepLink(url)
  if (!parsed) return false

  switch (parsed.target) {
    case 'capture':
      router.push('/capture')
      return true
    case 'approval':
      if (parsed.id) {
        router.push({ pathname: '/mobile-inbox-item', params: { inboxId: parsed.id } })
        return true
      }
      router.push({ pathname: '/inbox', params: { inboxId: parsed.id ?? '', inboxType: 'approval' } })
      return true
    case 'inbox':
      if (parsed.id) {
        if (parsed.action === 'discuss') {
          router.push({
            pathname: '/mobile-thread',
            params: {
              inboxId: parsed.id,
              action: 'discuss',
              mode: parsed.params?.atlas_mode ?? 'operational',
            },
          })
          return true
        }

        router.push({
          pathname: '/mobile-inbox-item',
          params: { inboxId: parsed.id, inboxAction: parsed.action ?? '' },
        })
      } else {
        router.push('/inbox')
      }
      return true
    case 'thread':
      if (parsed.id && parsed.id !== 'new') {
        if (handlers.openAtlasAi) {
          handlers.openAtlasAi(parsed.id)
        } else {
          router.push({ pathname: '/mobile-thread', params: { threadId: parsed.id } })
        }
        return true
      }
      if (handlers.openAtlasAi) {
        handlers.openAtlasAi(null)
      } else {
        router.push('/inbox')
      }
      return true
    case 'memory':
      router.push({ pathname: '/memory', params: parsed.params ?? {} })
      return true
    case 'job':
    case 'trace':
      router.push('/inbox')
      return true
    default:
      return false
  }
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
