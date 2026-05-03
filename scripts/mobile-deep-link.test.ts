import assert from 'node:assert/strict'
import { routeAtlasDeepLink } from '../lib/atlasDeepLinkCore'
import { resolveMobileThreadBridgeTarget } from '../lib/mobileThreadBridge'

async function main(): Promise<void> {
  const route = routeAtlasDeepLink('atlas://inbox/inbox-1/discuss')
  assert.deepEqual(route, {
    kind: 'router',
    href: {
      pathname: '/mobile-thread',
      params: {
        inboxId: 'inbox-1',
        action: 'discuss',
        mode: 'operational',
      },
    },
  })

  {
    const route = routeAtlasDeepLink('atlas://thread/thread-1', { canOpenAtlasAi: true })
    assert.deepEqual(route, { kind: 'atlas_ai', threadId: 'thread-1' })
  }

  {
    let calledWith: string | null = null
    let openedThreadId: string | null = null
    const threadId = await resolveMobileThreadBridgeTarget(
      { inboxId: 'inbox-1', action: 'discuss' },
      async (id) => {
        calledWith = id
        return { result: { thread_id: 'thread-1' } }
      },
    )

    const openAtlasAi = (id: string | null) => {
      openedThreadId = id
    }
    openAtlasAi(threadId)

    assert.equal(calledWith, 'inbox-1')
    assert.equal(threadId, 'thread-1')
    assert.equal(openedThreadId, 'thread-1')
  }

  {
    const threadId = await resolveMobileThreadBridgeTarget(
      { threadId: 'thread-direct', inboxId: 'inbox-1', action: 'discuss' },
      async () => {
        throw new Error('discuss should not run when threadId is already present')
      },
    )

    assert.equal(threadId, 'thread-direct')
  }

  await assert.rejects(
    () => resolveMobileThreadBridgeTarget(
      { inboxId: 'inbox-1', action: 'discuss' },
      async () => ({ result: {} }),
    ),
    /conversa operacional/,
  )

  console.info('mobile deep link routing tests passed')
}

void main()
