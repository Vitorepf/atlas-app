export interface AtlasDeepLink {
  target: string
  id?: string
  action?: string
  params?: Record<string, string>
}

export type AtlasDeepLinkRoute =
  | { kind: 'router'; href: any }
  | { kind: 'atlas_ai'; threadId: string | null }

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

export function routeAtlasDeepLink(
  url: string,
  options: { canOpenAtlasAi?: boolean } = {},
): AtlasDeepLinkRoute | null {
  const parsed = parseAtlasDeepLink(url)
  if (!parsed) return null

  switch (parsed.target) {
    case 'capture':
      return { kind: 'router', href: '/capture' }
    case 'approval':
      if (parsed.id) {
        return { kind: 'router', href: { pathname: '/mobile-inbox-item', params: { inboxId: parsed.id } } }
      }

      return {
        kind: 'router',
        href: { pathname: '/inbox', params: { inboxId: parsed.id ?? '', inboxType: 'approval' } },
      }
    case 'inbox':
      if (parsed.id) {
        if (parsed.action === 'discuss') {
          return {
            kind: 'router',
            href: {
              pathname: '/mobile-thread',
              params: {
                inboxId: parsed.id,
                action: 'discuss',
                mode: parsed.params?.atlas_mode ?? 'operational',
              },
            },
          }
        }

        return {
          kind: 'router',
          href: {
            pathname: '/mobile-inbox-item',
            params: { inboxId: parsed.id, inboxAction: parsed.action ?? '' },
          },
        }
      }

      return { kind: 'router', href: '/inbox' }
    case 'thread':
      if (parsed.id && parsed.id !== 'new') {
        return options.canOpenAtlasAi
          ? { kind: 'atlas_ai', threadId: parsed.id }
          : { kind: 'router', href: { pathname: '/mobile-thread', params: { threadId: parsed.id } } }
      }

      return options.canOpenAtlasAi
        ? { kind: 'atlas_ai', threadId: null }
        : { kind: 'router', href: '/inbox' }
    case 'memory':
      return { kind: 'router', href: { pathname: '/memory', params: parsed.params ?? {} } }
    case 'job':
    case 'trace':
      return { kind: 'router', href: '/inbox' }
    default:
      return null
  }
}
