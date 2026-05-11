export type InboxFilter =
  | 'open'
  | 'candidate'
  | 'proposal'
  | 'no_destination'
  | 'snoozed'
  | 'routed'
  | 'failed'
  | 'pending'
  | 'archived'

export type InboxSort = 'recent' | 'oldest' | 'needs_triage'
export type QuickAction = 'promote' | 'create_task' | 'create_project' | 'snooze' | 'archive'
export type BulkAction = 'promote' | 'snooze' | 'archive'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type OperationalFilter =
  | 'all'
  | 'approval'
  | 'recommendation'
  | 'insight'
  | 'proposal'
  | 'job'
  | 'self_diagnostic'
  | 'alert'
export type InboxMode = 'captures' | 'operational'

export type ProjectPlanDraft = {
  title: string
  nextAction: string
  priority: TaskPriority
  estimatedMinutes: string
}
