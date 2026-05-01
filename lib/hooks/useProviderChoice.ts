import { useEffect } from 'react'
import { useOverlays } from '../overlays'
import type { AtlasAiTrace, AtlasAiJob } from '../api/client'

function findPausedJob(traces: AtlasAiTrace[]): AtlasAiJob | null {
  for (const trace of traces) {
    const candidates: AtlasAiJob[] = []
    if (trace.job) candidates.push(trace.job)
    if (Array.isArray(trace.jobs)) candidates.push(...trace.jobs)

    for (const job of candidates) {
      if (job.status === 'awaiting_user_choice') {
        return job
      }
    }
  }
  return null
}

export function useProviderChoice(traces: AtlasAiTrace[]): void {
  const open = useOverlays((state) => state.open)
  const currentJobId = useOverlays((state) => state.providerChoiceJobId)
  const openProviderChoice = useOverlays((state) => state.openProviderChoice)
  const closeProviderChoice = useOverlays((state) => state.closeProviderChoice)

  useEffect(() => {
    const paused = findPausedJob(traces)

    if (paused) {
      if (currentJobId !== paused.id) {
        openProviderChoice({
          jobId: paused.id,
          errorCode: paused.provider_choice_error_code ?? null,
          resetHint: paused.reset_hint ?? null,
          options: paused.choice_options ?? [],
        })
      }
      return
    }

    if (open === 'providerChoice') {
      closeProviderChoice()
    }
  }, [traces, currentJobId, open, openProviderChoice, closeProviderChoice])
}
