import {
  AtlasApiError,
  createDomain as createServerDomain,
  listDomains,
  type AtlasDomain,
} from '../api/client'
import { DEFAULT_DOMAINS, mergeDomains, normalizeDomainFromApi, type Domain } from '../domains'
import { humanError } from './internals'
import { persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type DomainsSlice = Pick<AtlasState, 'domains' | 'refreshDomains' | 'createDomain'>

export const createDomainsSlice = (set: AtlasSet, get: AtlasGet): DomainsSlice => ({
  domains: DEFAULT_DOMAINS,

  refreshDomains: async () => {
    try {
      const response = await listDomains()
      const domains = mergeDomains(
        response.domains
          .map((domain: AtlasDomain) => normalizeDomainFromApi(domain as unknown as Record<string, unknown>))
          .filter((domain): domain is Domain => domain != null),
      )
      set({ domains, serverReachable: true, lastError: null })
      await persist(get())
    } catch (error) {
      set({ domains: mergeDomains(get().domains), lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
    }
  },

  createDomain: async (input) => {
    try {
      const response = await createServerDomain(input)
      const created = normalizeDomainFromApi(response as unknown as Record<string, unknown>)
      if (!created) {
        throw new Error('Domínio criado, mas resposta inválida do servidor.')
      }

      set((state) => ({
        domains: mergeDomains([...state.domains, created]),
        serverReachable: true,
        lastError: null,
      }))
      await persist(get())

      return created
    } catch (error) {
      set({ lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())

      return null
    }
  },
})
