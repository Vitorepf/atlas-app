import { useCallback, useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useShell } from '../components/AtlasShell'

interface RouterLike {
  push: (href: any) => void
}

export interface AtlasDeepLink {
  target: string
  id?: string
  action?: string
}

export function parseAtlasDeepLink(url: string): AtlasDeepLink | null {
  if (!url.startsWith('atlas://')) return null

  const withoutScheme = url.replace(/^atlas:\/\//, '')
  const query = withoutScheme.split('?')[1]?.split('#')[0] ?? ''
  const queryAction = new URLSearchParams(query).get('action') ?? undefined
  const clean = withoutScheme
    .split('?')[0]
    .split('#')[0]
    .replace(/^\/+/, '')
  const [target, id, action] = clean.split('/').filter(Boolean)
  if (!target) return null

  return { target, id, action: action ?? queryAction }
}

export function openAtlasDeepLink(url: string, router: RouterLike): boolean {
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
        router.push({ pathname: '/mobile-thread', params: { threadId: parsed.id } })
        return true
      }
      router.push('/inbox')
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
  const open = useCallback((url: string) => {
    const handled = openAtlasDeepLink(url, router)
    if (!handled) {
      router.push('/inbox')
      showToast('link invalido do Atlas', { durationMs: 2200 })
    }
  }, [router, showToast])

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
