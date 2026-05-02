import assert from 'node:assert/strict'
import {
  memoryEngineeringRunReviewParams,
  memoryProjectReviewParams,
  memoryTaskReviewParams,
} from '../lib/memoryReviewNavigation'

assert.deepEqual(memoryProjectReviewParams(' project-1 '), {
  project_id: 'project-1',
})

assert.deepEqual(memoryProjectReviewParams(' '), {})

assert.deepEqual(memoryTaskReviewParams('task-1', 'project-1'), {
  project_id: 'project-1',
  task_id: 'task-1',
})

assert.deepEqual(memoryTaskReviewParams(' task-2 '), {
  task_id: 'task-2',
})

assert.deepEqual(memoryEngineeringRunReviewParams('run-1', 'task-1', 'project-1'), {
  project_id: 'project-1',
  task_id: 'task-1',
  engineering_run_id: 'run-1',
})

assert.deepEqual(memoryEngineeringRunReviewParams('run-2'), {
  engineering_run_id: 'run-2',
})

console.log('memory review navigation tests passed')
