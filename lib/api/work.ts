// Work-management domain API surface (projects, tasks, agenda, routines), split out of ./client.
// Re-exported from ./client via `export * from './work'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core;
// sibling-split types come from their own modules (AtlasCapture from ./captures,
// AtlasCheckin from ./entities).
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, queryString } from './core'
import type { DomainKey } from '../domains'
import type { AtlasCapture, CaptureTriageAction } from './captures'
import type { AtlasCheckin } from './entities'

// CaptureTriageInput is the work-item creation payload used to triage a capture into a
// task/project. It is composed entirely of project/task fields (plus CaptureTriageAction) and
// lives here so the project-plan proposal functions that accept it stay in the work cluster.
// Its counterpart CaptureTriageResponse stays in ./client (it references the semantic type).
export interface CaptureTriageInput {
  action: CaptureTriageAction
  title?: string | null
  note_id?: string | null
  note_title?: string | null
  snoozed_until?: string | null
  due_at?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  planned_for_date?: string | null
  planned_start_at?: string | null
  planned_end_at?: string | null
  estimated_minutes?: number | null
  energy_required?: 'low' | 'medium' | 'high' | null
  urgency_score?: number | null
  impact_score?: number | null
  effort_score?: number | null
  priority_score?: number | null
  goal?: string | null
  next_action?: string | null
  project_type?: AtlasProjectType | null
  desired_outcome?: string | null
  minimum_viable_outcome?: string | null
  definition_of_done?: string | null
  why_now?: string | null
  deadline_at?: string | null
  deadline_kind?: AtlasDeadlineKind | null
  energy_profile?: AtlasProjectEnergyProfile | null
  avoidance_reason?: AtlasAvoidanceReason | null
  execution_mode?: AtlasExecutionMode | null
  friction_level?: number | null
  emotional_resistance?: number | null
  clarity_level?: number | null
  starter_step?: string | null
  minimum_viable_action?: string | null
  if_then_plan?: string | null
  reward_hint?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}

export interface AtlasDailyMission {
  id: string
  date: string
  timezone: string
  title: string
  detail: string | null
  status: 'active' | 'done' | 'skipped' | string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasTask {
  id: string
  title: string
  description: string | null
  status: 'open' | 'next' | 'waiting' | 'done' | 'archived' | string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  domain: DomainKey
  source_capture_id: string | null
  project_id: string | null
  project_step_id: string | null
  routine_id: string | null
  routine_occurrence_date: string | null
  project?: AtlasTaskProjectSummary | null
  project_step?: AtlasTaskProjectStepSummary | null
  routine?: AtlasTaskRoutineSummary | null
  due_at: string | null
  planned_for_date: string | null
  planned_start_at: string | null
  planned_end_at: string | null
  estimated_minutes: number
  energy_required: 'low' | 'medium' | 'high' | string
  urgency_score: number
  impact_score: number
  effort_score: number
  priority_score: number
  planning_status: 'unscheduled' | 'suggested' | 'planned' | 'scheduled' | 'deferred' | string
  completed_at: string | null
  execution_mode: AtlasExecutionMode | string
  friction_level: number
  emotional_resistance: number
  clarity_level: number
  starter_step: string | null
  minimum_viable_action: string | null
  if_then_plan: string | null
  reward_hint: string | null
  failure_reason_last: string | null
  attempt_count: number
  recovery_count: number
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface AtlasAgendaTask extends AtlasTask {
  project_title?: string | null
  project_type?: AtlasProjectType | string | null
  project_step_title?: string | null
  project_step_order?: number | null
  routine_title?: string | null
  routine_frequency?: AtlasRoutineFrequency | string | null
  agenda_score: number
  bucket: string
  agenda_intent?: string | null
  agenda_risk?: string | null
  project_signal?: Record<string, unknown> | null
  why: string[]
  recommended_start_at?: string | null
  recommended_end_at?: string | null
}

export type AtlasProjectType =
  | 'study'
  | 'technical_build'
  | 'creative'
  | 'business'
  | 'research'
  | 'writing'
  | 'health'
  | 'admin'
  | 'personal'
  | 'tedious'
  | 'routine_candidate'

export type AtlasDeadlineKind = 'real' | 'desired' | 'artificial' | 'none'
export type AtlasProjectEnergyProfile = 'low' | 'medium' | 'high' | 'mixed'
export type AtlasAvoidanceReason =
  | 'unclear'
  | 'boring'
  | 'too_large'
  | 'scary'
  | 'perfectionism'
  | 'no_reward'
  | 'low_energy'
  | 'dependency'
  | 'unknown'
export type AtlasExecutionMode =
  | 'quick_win'
  | 'deep_work'
  | 'admin'
  | 'study'
  | 'tedious'
  | 'creative'
  | 'decision'
  | 'maintenance'
  | 'recovery'

export interface AtlasTaskProjectSummary {
  id: string
  title: string
  status: string
  domain: DomainKey
  project_type: AtlasProjectType | string
}

export interface AtlasTaskProjectStepSummary {
  id: string
  title: string
  status: string
  step_order: number
  step_type: string
}

export type AtlasRoutineStatus = 'active' | 'paused' | 'archived'
export type AtlasRoutineFrequency = 'daily' | 'weekdays' | 'weekly' | 'custom'

export interface AtlasTaskRoutineSummary {
  id: string
  title: string
  status: AtlasRoutineStatus | string
  domain: DomainKey
  frequency: AtlasRoutineFrequency | string
}

export interface AtlasRoutine {
  id: string
  title: string
  description: string | null
  status: AtlasRoutineStatus | string
  domain: DomainKey
  source_capture_id: string | null
  project_id: string | null
  project?: AtlasTaskProjectSummary | null
  frequency: AtlasRoutineFrequency | string
  weekdays: number[]
  timezone: string
  preferred_time: string | null
  estimated_minutes: number
  energy_required: 'low' | 'medium' | 'high' | string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  execution_mode: AtlasExecutionMode | string
  friction_level: number
  emotional_resistance: number
  clarity_level: number
  starter_step: string | null
  minimum_viable_action: string | null
  if_then_plan: string | null
  reward_hint: string | null
  next_occurrence_date: string | null
  last_generated_for_date: string | null
  tasks_count?: number
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface AtlasProjectStep {
  id: string
  project_id: string
  active_task_id: string | null
  active_task?: AtlasTask | null
  step_order: number
  title: string
  description: string | null
  status: 'pending' | 'active' | 'done' | 'skipped' | 'blocked' | string
  step_type: 'phase' | 'action' | 'milestone' | 'review' | string
  expected_output: string | null
  acceptance_criteria: string | null
  estimated_minutes: number
  energy_required: 'low' | 'medium' | 'high' | string
  friction_level: number
  metadata: Record<string, unknown>
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasProject {
  id: string
  title: string
  description: string | null
  status: 'active' | 'paused' | 'blocked' | 'waiting' | 'completed' | 'archived' | string
  domain: DomainKey
  source_capture_id: string | null
  goal: string | null
  next_action: string | null
  project_type: AtlasProjectType | string
  desired_outcome: string | null
  minimum_viable_outcome: string | null
  definition_of_done: string | null
  why_now: string | null
  deadline_at: string | null
  deadline_kind: AtlasDeadlineKind | string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  energy_profile: AtlasProjectEnergyProfile | string
  avoidance_reason: AtlasAvoidanceReason | string
  active_next_task_id: string | null
  active_next_task?: AtlasTask | null
  current_step_id: string | null
  current_step?: AtlasProjectStep | null
  tasks_count?: number
  steps_count?: number
  open_blockers_count?: number
  top_blocker?: AtlasProjectBlocker | null
  execution_health?: {
    status: 'healthy' | 'attention' | 'paused' | 'completed' | 'archived' | string
    reasons: string[]
    score: number
    missing_next_action: boolean
    review_due: boolean
    overdue: boolean
    deferred_action?: boolean
    deferred_ready?: boolean
    open_blockers_count?: number
    has_open_blockers?: boolean
    last_touched_days: number | null
  }
  last_touched_at: string | null
  next_review_at: string | null
  completed_at: string | null
  paused_until: string | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export type AtlasProjectBlockerReasonCode =
  | 'unclear'
  | 'too_large'
  | 'boring'
  | 'waiting_external'
  | 'missing_resource'
  | 'fear'
  | 'energy'
  | 'technical_unknown'
  | 'decision_needed'
  | 'other'

export type AtlasProjectBlockerStatus = 'open' | 'resolved' | 'cancelled'
export type AtlasProjectBlockerSeverity = 'low' | 'medium' | 'high'

export interface AtlasProjectBlocker {
  id: string
  project_id: string
  task_id: string | null
  project_step_id: string | null
  unblock_task_id: string | null
  status: AtlasProjectBlockerStatus | string
  severity: AtlasProjectBlockerSeverity | string
  reason_code: AtlasProjectBlockerReasonCode | string
  description: string
  unblock_next_action: string | null
  waiting_on: string | null
  due_at: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_from_event_id: string | null
  project?: Pick<AtlasProject, 'id' | 'title' | 'status' | 'domain'> | null
  task?: Pick<AtlasTask, 'id' | 'title' | 'status' | 'planning_status'> | null
  project_step?: Pick<AtlasProjectStep, 'id' | 'title' | 'status' | 'step_order'> | null
  unblock_task?: Pick<AtlasTask, 'id' | 'title' | 'status' | 'planning_status'> | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export type AtlasProjectPlanProposalStatus =
  | 'draft'
  | 'pending_review'
  | 'accepted'
  | 'rejected'
  | 'superseded'
  | string

export interface AtlasProjectPlanProposal {
  id: string
  project_id: string | null
  source_capture_id: string | null
  status: AtlasProjectPlanProposalStatus
  proposed_title: string
  planner_version: string
  input_hash: string
  project_type: AtlasProjectType | string
  avoidance_profile: AtlasAvoidanceReason | string
  desired_outcome: string
  definition_of_done: string
  minimum_useful_result: string
  first_milestone: string | null
  first_next_action: string
  estimated_energy: AtlasProjectEnergyProfile | string
  estimated_duration_minutes: number
  priority_suggestion: 'low' | 'normal' | 'high' | 'urgent' | string
  confidence: number
  phases: unknown[]
  steps: unknown[]
  risks: unknown[]
  questions: unknown[]
  rationale: string
  metadata: Record<string, unknown>
  accepted_at: string | null
  rejected_at: string | null
  project?: Pick<AtlasProject, 'id' | 'title' | 'status' | 'domain'> | null
  source_capture?: Pick<AtlasCapture, 'id' | 'kind' | 'domain' | 'captured_at'> | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasTaskEvent {
  id: string
  task_id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
  updated_at: string | null
}
export interface AtlasProjectEvent {
  id: string
  project_id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasRoutineEvent {
  id: string
  routine_id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasCalendarBlock {
  id: string
  block_date: string
  timezone: string
  title: string
  starts_at: string
  ends_at: string
  source: 'manual' | 'external_calendar' | 'rize' | 'system' | string
  source_ref: string | null
  task_id: string | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface AtlasTaskAgendaResponse {
  date: string
  timezone: string
  capacity_minutes: number
  scheduled_minutes: number
  energy_level: number | null
  context?: {
    energy_level: number | null
    energy_source: string | null
    checkin_state: AtlasCheckin['state'] | null
    mood_level: number | null
    readiness_score: number | null
    current_score: number | null
    sleep_duration_hours: number | null
    deep_work_minutes: number | null
    algorithmic_input_minutes: number | null
    digital_load: string | null
  }
  summary: {
    task_count: number
    backlog_count: number
    focus_task: string | null
    strategy: string
  }
  blocks?: AtlasCalendarBlock[]
  tasks: AtlasAgendaTask[]
  backlog: AtlasAgendaTask[]
}

export interface AtlasTaskAgendaPlanResponse {
  date: string
  timezone: string
  planned_count: number
  skipped_count: number
  planned_tasks: Array<AtlasAgendaTask & { calendar_block_id?: string | null }>
  skipped_tasks: Array<{ id: string; reason: string; planned_start_at?: string | null }>
  agenda: AtlasTaskAgendaResponse
}

export interface AtlasTaskWeekAgendaDay {
  date: string
  weekday: string
  is_weekend: boolean
  capacity_minutes: number
  agenda: AtlasTaskAgendaResponse
}

export interface AtlasTaskWeekAgendaResponse {
  start_date: string
  end_date: string
  timezone: string
  days_count: number
  summary: {
    task_count: number
    scheduled_minutes: number
    focus_days: number
    strategy: string
  }
  days: AtlasTaskWeekAgendaDay[]
}

export interface AtlasTaskWeekAgendaPlanResponse {
  start_date: string
  end_date: string
  timezone: string
  planned_count: number
  skipped_count: number
  planned_tasks: Array<AtlasAgendaTask & { date: string; calendar_block_id?: string | null }>
  skipped_tasks: Array<{ id: string | null; reason: string; date: string; planned_start_at?: string | null }>
  week: AtlasTaskWeekAgendaResponse
}

export interface TasksResponse {
  tasks: AtlasTask[]
}

export interface ProjectsResponse {
  projects: AtlasProject[]
}

export interface RoutinesResponse {
  routines: AtlasRoutine[]
}

export interface ProjectStepsResponse {
  steps: AtlasProjectStep[]
}

export interface TaskEventsResponse {
  events: AtlasTaskEvent[]
}

export interface ProjectEventsResponse {
  events: AtlasProjectEvent[]
}

export interface RoutineEventsResponse {
  events: AtlasRoutineEvent[]
}

export interface CreateProjectResponse {
  project: AtlasProject
  active_next_task: AtlasTask
}

export interface ProjectNextActionResponse {
  project: AtlasProject
  task: AtlasTask
}

export interface ProjectPlanResponse {
  project: AtlasProject
  steps: AtlasProjectStep[]
  active_next_task: AtlasTask
}

export interface ProjectPlanProposalsResponse {
  proposals: AtlasProjectPlanProposal[]
}

export interface ProjectPlanProposalAcceptResponse {
  proposal: AtlasProjectPlanProposal
  project: AtlasProject
  active_next_task: AtlasTask
}

export interface ProjectExecutionPacket {
  status: 'ready' | 'no_active_action' | string
  project_id: string
  task_id: string | null
  step_id: string | null
  title: string
  mode: string
  timebox_minutes: number | null
  starter_step: string | null
  minimum_viable_action: string | null
  done_when: string | null
  if_then_plan: string | null
  reward_hint: string | null
  low_energy_action: string | null
  avoid_now: string | null
  attempt_count: number
  friction_level?: number
  energy_required?: string | null
  next_review_at?: string | null
  why?: string[]
  generated_at: string
}

export interface ProjectExecutionResponse {
  project: AtlasProject
  active_next_task: AtlasTask | null
  packet: ProjectExecutionPacket
}

export interface ProjectReviewSuggestion {
  action: 'mark_reviewed' | 'postpone' | 'ensure_next_action' | 'rebuild_plan' | 'reactivate' | 'review_blocker' | 'recover' | string
  label: string
  reason: string
  proposed_next_action: string | null
  review_interval_days: number
  target_minutes?: number | null
  defer_reason_code?: string | null
}

export interface ProjectReviewItem {
  project: AtlasProject
  health: NonNullable<AtlasProject['execution_health']>
  suggestion: ProjectReviewSuggestion
  review_score: number
}

export interface ProjectReviewQueueResponse {
  items: ProjectReviewItem[]
  summary: {
    count: number
    blocked_count: number
    missing_next_action_count: number
    review_due_count: number
  }
  generated_at: string
}

export interface ProjectReviewActionResponse {
  project: AtlasProject
  active_next_task: AtlasTask | null
  health: NonNullable<AtlasProject['execution_health']>
  suggestion: ProjectReviewSuggestion
}

export interface ProjectStepMutationResponse {
  project: AtlasProject
  step: AtlasProjectStep
  active_next_task: AtlasTask | null
}

export interface ProjectBlockersResponse {
  blockers: AtlasProjectBlocker[]
  summary: {
    open_count: number
    resolved_count: number
    cancelled_count: number
  }
  generated_at: string
}

export interface ProjectBlockerMutationResponse {
  project: AtlasProject
  blocker: AtlasProjectBlocker
  unblock_task: AtlasTask | null
  health: NonNullable<AtlasProject['execution_health']>
}

export interface CalendarBlocksResponse {
  blocks: AtlasCalendarBlock[]
}

export interface RoutineGenerateResponse {
  routine: AtlasRoutine
  task: AtlasTask | null
}

export interface RoutinesGenerateDueResponse {
  date: string
  timezone: string
  generated_count: number
  created_count: number
  routines: AtlasRoutine[]
  tasks: AtlasTask[]
}
export interface MissionTodayResponse {
  date: string
  timezone: string
  mission: AtlasDailyMission | null
}
export async function getTodayMission(params: { date?: string; timezone?: string } = {}): Promise<MissionTodayResponse> {
  return apiGet<MissionTodayResponse>(`/mission/today${queryString(params)}`)
}

export async function listTaskAgenda(params: {
  date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  capacity_minutes?: number
  limit?: number
} = {}): Promise<AtlasTaskAgendaResponse> {
  return apiGet<AtlasTaskAgendaResponse>(`/tasks/agenda${queryString(params)}`)
}

export async function planTaskAgenda(input: {
  date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  capacity_minutes?: number
  limit?: number
  force?: boolean
  create_blocks?: boolean
} = {}): Promise<AtlasTaskAgendaPlanResponse> {
  return apiPost<AtlasTaskAgendaPlanResponse>('/tasks/agenda/plan', input)
}

export async function listTaskWeekAgenda(params: {
  start_date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  days?: number
  weekday_capacity_minutes?: number
  weekend_capacity_minutes?: number
  capacity_minutes?: number
  daily_limit?: number
  limit?: number
  include_weekends?: boolean
} = {}): Promise<AtlasTaskWeekAgendaResponse> {
  return apiGet<AtlasTaskWeekAgendaResponse>(`/tasks/agenda/week${queryString(params)}`)
}

export async function planTaskWeekAgenda(input: {
  start_date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  days?: number
  weekday_capacity_minutes?: number
  weekend_capacity_minutes?: number
  capacity_minutes?: number
  daily_limit?: number
  limit?: number
  include_weekends?: boolean
  force?: boolean
  create_blocks?: boolean
} = {}): Promise<AtlasTaskWeekAgendaPlanResponse> {
  return apiPost<AtlasTaskWeekAgendaPlanResponse>('/tasks/agenda/week/plan', input)
}

export async function listTasks(params: {
  domain?: string
  status?: string
  limit?: number
} = {}): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks${queryString(params)}`)
}

export async function listRoutines(params: {
  domain?: string
  status?: AtlasRoutineStatus | 'all'
  limit?: number
} = {}): Promise<RoutinesResponse> {
  return apiGet<RoutinesResponse>(`/routines${queryString(params)}`)
}

export async function createRoutine(input: {
  title: string
  description?: string | null
  status?: AtlasRoutineStatus
  domain: string
  source_capture_id?: string | null
  project_id?: string | null
  frequency?: AtlasRoutineFrequency
  weekdays?: number[]
  timezone?: string
  preferred_time?: string | null
  estimated_minutes?: number
  energy_required?: 'low' | 'medium' | 'high'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  execution_mode?: AtlasExecutionMode
  friction_level?: number
  emotional_resistance?: number
  clarity_level?: number
  starter_step?: string | null
  minimum_viable_action?: string | null
  if_then_plan?: string | null
  reward_hint?: string | null
  next_occurrence_date?: string | null
  metadata?: Record<string, unknown>
}): Promise<AtlasRoutine> {
  return apiPost<AtlasRoutine>('/routines', input)
}

export async function patchRoutine(
  id: string,
  patch: Partial<Pick<AtlasRoutine,
    | 'title'
    | 'description'
    | 'status'
    | 'domain'
    | 'source_capture_id'
    | 'project_id'
    | 'frequency'
    | 'weekdays'
    | 'timezone'
    | 'preferred_time'
    | 'estimated_minutes'
    | 'energy_required'
    | 'priority'
    | 'execution_mode'
    | 'friction_level'
    | 'emotional_resistance'
    | 'clarity_level'
    | 'starter_step'
    | 'minimum_viable_action'
    | 'if_then_plan'
    | 'reward_hint'
    | 'next_occurrence_date'
    | 'metadata'
  >>,
): Promise<AtlasRoutine> {
  return apiPatch<AtlasRoutine>(`/routines/${encodeURIComponent(id)}`, patch)
}

export async function generateRoutineOccurrence(
  id: string,
  input: { date?: string; timezone?: string } = {},
): Promise<RoutineGenerateResponse> {
  return apiPost<RoutineGenerateResponse>(`/routines/${encodeURIComponent(id)}/generate`, input)
}

export async function generateDueRoutines(input: {
  date?: string
  timezone?: string
  domain?: string
} = {}): Promise<RoutinesGenerateDueResponse> {
  return apiPost<RoutinesGenerateDueResponse>('/routines/generate-due', input)
}

export async function listRoutineEvents(id: string, params: { limit?: number } = {}): Promise<RoutineEventsResponse> {
  return apiGet<RoutineEventsResponse>(`/routines/${encodeURIComponent(id)}/events${queryString(params)}`)
}

export async function listProjects(params: {
  domain?: string
  status?: string
  limit?: number
} = {}): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects${queryString(params)}`)
}

export async function listProjectReviewQueue(params: {
  domain?: string
  mode?: 'attention' | 'all'
  limit?: number
} = {}): Promise<ProjectReviewQueueResponse> {
  return apiGet<ProjectReviewQueueResponse>(`/projects/review${queryString(params)}`)
}

export async function createProject(input: {
  title: string
  description?: string | null
  status?: AtlasProject['status']
  domain: string
  source_capture_id?: string | null
  goal?: string | null
  next_action?: string | null
  project_type?: AtlasProjectType | null
  desired_outcome?: string | null
  minimum_viable_outcome?: string | null
  definition_of_done?: string | null
  why_now?: string | null
  deadline_at?: string | null
  deadline_kind?: AtlasDeadlineKind | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  energy_profile?: AtlasProjectEnergyProfile | null
  avoidance_reason?: AtlasAvoidanceReason | null
  next_review_at?: string | null
  metadata?: Record<string, unknown>
}): Promise<CreateProjectResponse> {
  return apiPost<CreateProjectResponse>('/projects', input)
}

export async function patchProject(
  id: string,
  patch: Partial<Pick<AtlasProject,
    | 'title'
    | 'description'
    | 'status'
    | 'domain'
    | 'source_capture_id'
    | 'goal'
    | 'next_action'
    | 'project_type'
    | 'desired_outcome'
    | 'minimum_viable_outcome'
    | 'definition_of_done'
    | 'why_now'
    | 'deadline_at'
    | 'deadline_kind'
    | 'priority'
    | 'energy_profile'
    | 'avoidance_reason'
    | 'last_touched_at'
    | 'next_review_at'
    | 'completed_at'
    | 'paused_until'
    | 'metadata'
  >> & {
    completion_outcome?: string | null
    completion_evidence?: string | null
    completion_note?: string | null
    force_completion?: boolean | null
  },
): Promise<AtlasProject> {
  return apiPatch<AtlasProject>(`/projects/${encodeURIComponent(id)}`, patch)
}

export async function createProjectNextAction(
  id: string,
  input: {
    title?: string | null
    next_action?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    due_at?: string | null
    estimated_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<ProjectNextActionResponse> {
  return apiPost<ProjectNextActionResponse>(`/projects/${encodeURIComponent(id)}/next-action`, input)
}

export async function listProjectSteps(
  id: string,
  params: { status?: AtlasProjectStep['status'] } = {},
): Promise<ProjectStepsResponse> {
  return apiGet<ProjectStepsResponse>(`/projects/${encodeURIComponent(id)}/steps${queryString(params)}`)
}

export async function rebuildProjectPlan(
  id: string,
  input: {
    replace?: boolean
    next_action?: string | null
    goal?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<ProjectPlanResponse> {
  return apiPost<ProjectPlanResponse>(`/projects/${encodeURIComponent(id)}/plan`, input)
}

export async function listProjectPlanProposals(id: string): Promise<ProjectPlanProposalsResponse> {
  return apiGet<ProjectPlanProposalsResponse>(`/projects/${encodeURIComponent(id)}/plan/proposals`)
}

export async function proposeProjectPlan(
  id: string,
  input: {
    title?: string | null
    description?: string | null
    goal?: string | null
    next_action?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    project_type?: AtlasProjectType | null
    desired_outcome?: string | null
    minimum_viable_outcome?: string | null
    definition_of_done?: string | null
    why_now?: string | null
    estimated_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    instruction?: string | null
    regeneration_instruction?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(`/projects/${encodeURIComponent(id)}/plan/propose`, input)
}

export async function acceptProjectScopedPlanProposal(
  projectId: string,
  proposalId: string,
  input: Partial<CaptureTriageInput> = {},
): Promise<ProjectPlanProposalAcceptResponse> {
  return apiPost<ProjectPlanProposalAcceptResponse>(
    `/projects/${encodeURIComponent(projectId)}/plan/proposals/${encodeURIComponent(proposalId)}/accept`,
    input,
  )
}

export async function rejectProjectScopedPlanProposal(
  projectId: string,
  proposalId: string,
  input: { reason?: string | null } = {},
): Promise<{ proposal: AtlasProjectPlanProposal }> {
  return apiPost<{ proposal: AtlasProjectPlanProposal }>(
    `/projects/${encodeURIComponent(projectId)}/plan/proposals/${encodeURIComponent(proposalId)}/reject`,
    input,
  )
}

export async function regenerateProjectScopedPlanProposal(
  projectId: string,
  proposalId: string,
  input: {
    title?: string | null
    goal?: string | null
    next_action?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    project_type?: AtlasProjectType | null
    instruction?: string | null
    regeneration_instruction?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(
    `/projects/${encodeURIComponent(projectId)}/plan/proposals/${encodeURIComponent(proposalId)}/regenerate`,
    input,
  )
}

export async function getProjectExecution(
  id: string,
  params: {
    available_minutes?: number | null
    energy_level?: number | null
    environment?: string | null
  } = {},
): Promise<ProjectExecutionResponse> {
  return apiGet<ProjectExecutionResponse>(`/projects/${encodeURIComponent(id)}/execution${queryString(params)}`)
}

export async function startProjectExecution(
  id: string,
  input: {
    available_minutes?: number | null
    energy_level?: number | null
    environment?: string | null
    note?: string | null
  } = {},
): Promise<ProjectExecutionResponse> {
  return apiPost<ProjectExecutionResponse>(`/projects/${encodeURIComponent(id)}/execution/start`, input)
}

export async function recoverProjectExecution(
  id: string,
  input: {
    available_minutes?: number | null
    target_minutes?: number | null
    next_action?: string | null
    reason?: string | null
  } = {},
): Promise<ProjectExecutionResponse> {
  return apiPost<ProjectExecutionResponse>(`/projects/${encodeURIComponent(id)}/recover`, input)
}

export async function reviewProject(
  id: string,
  input: {
    action?: 'mark_reviewed' | 'postpone' | 'ensure_next_action' | 'rebuild_plan' | 'reactivate' | 'recover'
    review_interval_days?: number | null
    next_action?: string | null
    goal?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    estimated_minutes?: number | null
    target_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    note?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<ProjectReviewActionResponse> {
  return apiPost<ProjectReviewActionResponse>(`/projects/${encodeURIComponent(id)}/review`, input)
}

export async function patchProjectStep(
  projectId: string,
  stepId: string,
  patch: Partial<Pick<AtlasProjectStep,
    | 'title'
    | 'description'
    | 'status'
    | 'step_type'
    | 'expected_output'
    | 'acceptance_criteria'
    | 'estimated_minutes'
    | 'energy_required'
    | 'friction_level'
    | 'metadata'
  >>,
): Promise<ProjectStepMutationResponse> {
  return apiPatch<ProjectStepMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/steps/${encodeURIComponent(stepId)}`,
    patch,
  )
}

export async function activateProjectStep(
  projectId: string,
  stepId: string,
): Promise<ProjectStepMutationResponse> {
  return apiPost<ProjectStepMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/steps/${encodeURIComponent(stepId)}/activate`,
    {},
  )
}

export async function listProjectBlockers(
  projectId: string,
  params: { status?: AtlasProjectBlockerStatus | string; limit?: number } = {},
): Promise<ProjectBlockersResponse> {
  return apiGet<ProjectBlockersResponse>(`/projects/${encodeURIComponent(projectId)}/blockers${queryString(params)}`)
}

export async function createProjectBlocker(
  projectId: string,
  input: {
    task_id?: string | null
    project_step_id?: string | null
    severity?: AtlasProjectBlockerSeverity | null
    reason_code?: AtlasProjectBlockerReasonCode | null
    blocker_reason_code?: AtlasProjectBlockerReasonCode | null
    description?: string | null
    blocker?: string | null
    reason?: string | null
    note?: string | null
    unblock_next_action?: string | null
    next_hint?: string | null
    waiting_on?: string | null
    due_at?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<ProjectBlockerMutationResponse> {
  return apiPost<ProjectBlockerMutationResponse>(`/projects/${encodeURIComponent(projectId)}/blockers`, input)
}

export async function resolveProjectBlocker(
  projectId: string,
  blockerId: string,
  input: { resolution_note?: string | null; note?: string | null } = {},
): Promise<ProjectBlockerMutationResponse> {
  return apiPost<ProjectBlockerMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/resolve`,
    input,
  )
}

export async function convertProjectBlockerToTask(
  projectId: string,
  blockerId: string,
  input: {
    title?: string | null
    description?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    estimated_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    starter_step?: string | null
    minimum_viable_action?: string | null
  } = {},
): Promise<ProjectBlockerMutationResponse> {
  return apiPost<ProjectBlockerMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/task`,
    input,
  )
}

export async function patchTask(
  id: string,
  patch: Partial<Pick<AtlasTask,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'project_id'
    | 'project_step_id'
    | 'due_at'
    | 'planned_for_date'
    | 'planned_start_at'
    | 'planned_end_at'
    | 'estimated_minutes'
    | 'energy_required'
    | 'urgency_score'
    | 'impact_score'
    | 'effort_score'
    | 'priority_score'
    | 'planning_status'
    | 'completed_at'
    | 'execution_mode'
    | 'friction_level'
    | 'emotional_resistance'
    | 'clarity_level'
    | 'starter_step'
    | 'minimum_viable_action'
    | 'if_then_plan'
    | 'reward_hint'
    | 'failure_reason_last'
    | 'attempt_count'
    | 'recovery_count'
    | 'metadata'
  >>,
): Promise<AtlasTask> {
  return apiPatch<AtlasTask>(`/tasks/${encodeURIComponent(id)}`, patch)
}

export async function scheduleTask(
  id: string,
  input: {
    planned_for_date?: string | null
    planned_start_at?: string | null
    planned_end_at?: string | null
    estimated_minutes?: number | null
    timezone?: string
    note?: string | null
  },
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/schedule`, input)
}

export async function deferTask(
  id: string,
  input: {
    defer_until?: string | null
    timezone?: string
    reason?: string | null
    reason_code?: 'low_energy' | 'too_big' | 'unclear' | 'blocked' | 'waiting' | 'calendar' | 'avoidance' | 'not_now' | null
  } = {},
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/defer`, input)
}

export async function completeTask(
  id: string,
  input: {
    completed_at?: string | null
    note?: string | null
    actual_minutes?: number | null
    completion_quality?: 'complete' | 'partial' | 'learned' | 'blocked' | null
    energy_after?: number | null
    outcome?: string | null
    evidence?: string | null
    blocker?: string | null
    blocker_reason_code?: AtlasProjectBlockerReasonCode | null
    blocker_severity?: AtlasProjectBlockerSeverity | null
    unblock_next_action?: string | null
    waiting_on?: string | null
    next_hint?: string | null
  } = {},
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/complete`, input)
}

export async function listTaskEvents(id: string, params: { limit?: number } = {}): Promise<TaskEventsResponse> {
  return apiGet<TaskEventsResponse>(`/tasks/${encodeURIComponent(id)}/events${queryString(params)}`)
}
export async function listProjectEvents(id: string, params: { limit?: number } = {}): Promise<ProjectEventsResponse> {
  return apiGet<ProjectEventsResponse>(`/projects/${encodeURIComponent(id)}/events${queryString(params)}`)
}

export async function listCalendarBlocks(params: {
  date?: string
  date_from?: string
  date_to?: string
  timezone?: string
  source?: string
  limit?: number
} = {}): Promise<CalendarBlocksResponse> {
  return apiGet<CalendarBlocksResponse>(`/calendar/blocks${queryString(params)}`)
}

export async function createCalendarBlock(input: {
  block_date?: string | null
  timezone: string
  title: string
  starts_at: string
  ends_at: string
  source?: 'manual' | 'external_calendar' | 'rize' | 'system' | string
  source_ref?: string | null
  task_id?: string | null
  metadata?: Record<string, unknown>
}): Promise<AtlasCalendarBlock> {
  return apiPost<AtlasCalendarBlock>('/calendar/blocks', input)
}

export async function patchCalendarBlock(
  id: string,
  patch: Partial<Pick<AtlasCalendarBlock, 'block_date' | 'timezone' | 'title' | 'starts_at' | 'ends_at' | 'source' | 'source_ref' | 'task_id' | 'metadata'>>,
): Promise<AtlasCalendarBlock> {
  return apiPatch<AtlasCalendarBlock>(`/calendar/blocks/${encodeURIComponent(id)}`, patch)
}

export async function deleteCalendarBlock(id: string): Promise<AtlasCalendarBlock> {
  return apiDelete<AtlasCalendarBlock>(`/calendar/blocks/${encodeURIComponent(id)}`)
}

export async function upsertTodayMission(input: {
  date?: string
  timezone?: string
  title: string
  detail?: string | null
  status?: string
  metadata?: Record<string, unknown>
}): Promise<AtlasDailyMission> {
  return apiPut<AtlasDailyMission>('/mission/today', input)
}
