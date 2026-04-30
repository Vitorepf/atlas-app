import { Platform } from 'react-native'
import * as Calendar from 'expo-calendar'

const ATLAS_CALENDAR_TITLE = 'Atlas'
const ATLAS_CALENDAR_COLOR = '#1B3A57'

export type AppleCalendarEventInput = {
  title: string
  startsAt: string
  endsAt: string
  notes?: string | null
  timeZone?: string
  alarmMinutesBefore?: number | null
}

export type AppleCalendarEventResult = {
  eventId: string
  calendarId: string
  calendarTitle: string
}

export async function createAppleCalendarEvent(input: AppleCalendarEventInput): Promise<AppleCalendarEventResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('Calendário Apple disponível apenas no iOS.')
  }

  const permission = await Calendar.requestCalendarPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Permissão do Calendário não concedida.')
  }

  const calendar = await atlasCalendar()
  const startDate = new Date(input.startsAt)
  const endDate = new Date(input.endsAt)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    throw new Error('Horário inválido para criar evento.')
  }

  const eventId = await Calendar.createEventAsync(calendar.id, {
    title: input.title,
    startDate,
    endDate,
    timeZone: input.timeZone,
    notes: input.notes ?? undefined,
    availability: Calendar.Availability.BUSY,
    alarms: input.alarmMinutesBefore === null
      ? []
      : [{ relativeOffset: -(input.alarmMinutesBefore ?? 10) }],
  })

  return {
    eventId,
    calendarId: calendar.id,
    calendarTitle: calendar.title,
  }
}

export function canUseAppleCalendar(): boolean {
  return Platform.OS === 'ios'
}

async function atlasCalendar(): Promise<Calendar.Calendar> {
  const existing = await findAtlasCalendar()
  if (existing) {
    return existing
  }

  const defaultCalendar = await defaultEventCalendar()
  const details: Partial<Calendar.Calendar> = {
    title: ATLAS_CALENDAR_TITLE,
    color: ATLAS_CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
  }

  const sourceId = defaultCalendar?.sourceId ?? defaultCalendar?.source?.id
  if (sourceId) {
    details.sourceId = sourceId
  }

  const calendarId = await Calendar.createCalendarAsync(details)
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
  const created = calendars.find((calendar) => calendar.id === calendarId)
  if (created?.allowsModifications) {
    return created
  }

  const createdByTitle = calendars.find(isWritableAtlasCalendar)
  if (createdByTitle) {
    return createdByTitle
  }

  throw new Error('Não consegui criar o calendário Atlas no iPhone.')
}

async function findAtlasCalendar(): Promise<Calendar.Calendar | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
  return calendars.find(isWritableAtlasCalendar) ?? null
}

async function defaultEventCalendar(): Promise<Calendar.Calendar | null> {
  try {
    return await Calendar.getDefaultCalendarAsync()
  } catch {
    // iOS can fail to expose a default calendar source depending on account setup.
    return null
  }
}

function isWritableAtlasCalendar(calendar: Calendar.Calendar): boolean {
  return calendar.allowsModifications && normalizeCalendarTitle(calendar.title) === normalizeCalendarTitle(ATLAS_CALENDAR_TITLE)
}

function normalizeCalendarTitle(title: string): string {
  return title.trim().toLocaleLowerCase('pt-BR')
}
