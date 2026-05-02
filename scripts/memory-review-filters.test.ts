import assert from 'node:assert/strict'
import {
  DEFAULT_REVIEW_FILTERS,
  clearSavedMemoryReviewFilters,
  hasActiveReviewFilters,
  loadSavedMemoryReviewFilters,
  memoryReviewFiltersFromParams,
  memoryReviewFiltersToParams,
  saveMemoryReviewFilters,
  sameReviewFilters,
} from '../lib/memoryReviewFilters'

{
  const filters = memoryReviewFiltersFromParams({
    area: 'relation',
    severity: 'high',
    privacy_class: 'sensitive',
    task_id: 'task-1',
    include_unreviewed: '1',
    include_inactive: 'true',
  })
  assert.equal(filters.area, 'relation')
  assert.equal(filters.severity, 'high')
  assert.equal(filters.privacyClass, 'sensitive')
  assert.equal(filters.taskId, 'task-1')
  assert.equal(filters.includeUnreviewed, true)
  assert.equal(filters.includeInactive, true)
  assert.equal(hasActiveReviewFilters(filters), true)
}

{
  const filters = memoryReviewFiltersFromParams({
    area: 'invalid',
    severity: 'critical',
    privacy: 'public',
    include_unreviewed: 'no',
  })
  assert.equal(sameReviewFilters(filters, DEFAULT_REVIEW_FILTERS), true)
}

{
  const params = memoryReviewFiltersToParams({
    ...DEFAULT_REVIEW_FILTERS,
    area: 'memory_privacy',
    projectId: 'project-1',
    includeUnreviewed: true,
  })
  assert.deepEqual(params, {
    area: 'memory_privacy',
    project_id: 'project-1',
    include_unreviewed: '1',
  })
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main(): Promise<void> {
  await clearSavedMemoryReviewFilters()
  assert.equal(loadSavedMemoryReviewFilters(), null)
  await saveMemoryReviewFilters({
    ...DEFAULT_REVIEW_FILTERS,
    area: 'verbatim_privacy',
    taskId: 'task-2',
  })
  const saved = loadSavedMemoryReviewFilters()
  assert.equal(saved?.area, 'verbatim_privacy')
  assert.equal(saved?.taskId, 'task-2')
  await clearSavedMemoryReviewFilters()

  console.log('memory review filter tests passed')
}
