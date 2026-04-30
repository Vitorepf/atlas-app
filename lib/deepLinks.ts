import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'

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

  const clean = url
    .replace(/^atlas:\/\//, '')
    .split('?')[0]
    .split('#')[0]
    .replace(/^\/+/, '')
  const [target, id, action] = clean.split('/').filter(Boolean)
  if (!target) return null

  return { target, id, action }
}

export function openAtlasDeepLink(url: string, router: RouterLike): boolean {
  const parsed = parseAtlasDeepLink(url)
  if (!parsed) return false

  switch (parsed.target) {
    case 'capture':
      router.push('/capture')
      return true
    case 'approval':
      router.push({ pathname: '/inbox', params: { inboxId: parsed.id ?? '', inboxType: 'approval' } })
      return true
    case 'inbox':
      router.push({
        pathname: '/inbox',
        params: {
          inboxId: parsed.id ?? '',
          inboxAction: parsed.action ?? '',
        },
      })
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
      router.push('/inbox')
      return true
  }
}

export function useAtlasDeepLinks(): void {
  const router = useRouter()

  useEffect(() => {
    let active = true
    void Linking.getInitialURL().then((url) => {
      if (active && url) openAtlasDeepLink(url, router)
    })

    const subscription = Linking.addEventListener('url', ({ url }) => {
      openAtlasDeepLink(url, router)
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [router])
}
