export type MemoryReviewRouteParams = Record<string, string>

export function memoryProjectReviewParams(projectId: string | null | undefined): MemoryReviewRouteParams {
  const params: MemoryReviewRouteParams = {}
  const cleanProjectId = cleanId(projectId)
  if (cleanProjectId) params.project_id = cleanProjectId

  return params
}

export function memoryTaskReviewParams(
  taskId: string | null | undefined,
  projectId?: string | null,
): MemoryReviewRouteParams {
  const params = memoryProjectReviewParams(projectId)
  const cleanTaskId = cleanId(taskId)
  if (cleanTaskId) params.task_id = cleanTaskId

  return params
}

export function memoryEngineeringRunReviewParams(
  engineeringRunId: string | null | undefined,
  taskId?: string | null,
  projectId?: string | null,
): MemoryReviewRouteParams {
  const params = memoryTaskReviewParams(taskId, projectId)
  const cleanRunId = cleanId(engineeringRunId)
  if (cleanRunId) params.engineering_run_id = cleanRunId

  return params
}

function cleanId(value: string | null | undefined): string | null {
  const normalized = value?.trim()

  return normalized ? normalized : null
}
