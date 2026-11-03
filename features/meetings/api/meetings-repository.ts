import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { meetingFormatSchema, meetingSchema, type Meeting, type MeetingPeriod, type MeetingStatus } from "@/features/meetings/schemas"
import { loadPeopleNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { PAGE_LIMIT_MAX, paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { companyDateOf } from "@/lib/datetime"
import { simulateLatency } from "@/mocks/latency"
import { demoScopedManagerId } from "@/mocks/scope"
import { demoMeetings } from "@/mocks/meetings"
import { demoDate } from "@/mocks/team"

export type MeetingsQuery = PageParams & {
  /** null — без ограничения по датам (например, все встречи по лиду) */
  period: MeetingPeriod | null
  status: MeetingStatus | null
  hostId: string | null
  leadId: string | null
  search: string | null
  /** Только встречи, по которым нужно записать итог */
  outcomeRequired: boolean
}

export type MeetingsRepository = {
  listMeetings(query: MeetingsQuery): Promise<Paginated<Meeting>>
}

const meetingsPageSchema = paginatedSchema(meetingSchema)


/** Демо-границы периодов от демо-сегодня; в реальном режиме период разбирает backend */
const PERIOD_DAYS: Record<MeetingPeriod, [from: number, to: number]> = {
  yesterday: [-1, -1],
  today: [0, 0],
  tomorrow: [1, 1],
  week: [0, 6],
}

function matches(meeting: Meeting, query: MeetingsQuery): boolean {
  if (query.period) {
    const [from, to] = PERIOD_DAYS[query.period]
    const day = meeting.startsAt.slice(0, 10)
    if (day < demoDate(from) || day > demoDate(to)) return false
  }
  if (query.status && meeting.status !== query.status) return false
  if (query.hostId && meeting.host.id !== query.hostId) return false
  if (query.leadId && meeting.lead.id !== query.leadId) return false
  if (query.outcomeRequired && !meeting.outcomeRequired) return false
  if (!query.search) return true
  const needle = query.search.toLocaleLowerCase("ru")
  return [meeting.lead.name, meeting.notes ?? ""].some((value) => value.toLocaleLowerCase("ru").includes(needle))
}

const mockMeetingsRepository: MeetingsRepository = {
  async listMeetings({ limit, offset, ...requested }) {
    await simulateLatency(400)
    const query = { ...requested, hostId: await demoScopedManagerId(requested.hostId) }
    const meetings = demoMeetings
      .filter((meeting) => matches(meeting, { limit, offset, ...query }))
      .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
    return meetingsPageSchema.parse(paginate(meetings, { limit, offset }))
  },
}

/** Встреча из `GET /meetings/`; имена полей уже в camelCase */
const backendMeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["scheduled", "held", "no_show", "rescheduled", "cancelled"]),
  description: z.string().nullable(),
  location: z.string().nullable(),
  subjectType: z.enum(["customer", "deal"]).nullable(),
  subjectId: z.string().nullable(),
  scheduledStart: z.iso.datetime({ offset: true }),
  scheduledEnd: z.iso.datetime({ offset: true }),
  ownerUserId: z.string(),
  format: meetingFormatSchema,
  hostUserId: z.string().nullable(),
  bookedByUserId: z.string().nullable(),
  confirmedAt: z.iso.datetime({ offset: true }).nullable(),
  outcome: z.string().nullable(),
})

export type BackendMeeting = z.infer<typeof backendMeetingSchema>

const backendMeetingsPageSchema = paginatedSchema(backendMeetingSchema)
const titleSchema = z.object({ id: z.string(), title: z.string() })
const nameSchema = z.object({ id: z.string(), name: z.string() })

/** Сегодня + n дней (YYYY-MM-DD) в часовом поясе компании; границы дней backend считает так же */
export function companyDay(offsetDays: number): string {
  return companyDateOf(new Date(Date.now() + offsetDays * 86_400_000).toISOString())
}

const PERIOD_RANGE: Record<MeetingPeriod, [from: number, to: number]> = {
  yesterday: [-1, -1],
  today: [0, 0],
  tomorrow: [1, 1],
  week: [0, 6],
}

/** Названия сделок и клиентов, к которым привязаны встречи страницы */
async function subjectNames(auth: ApiAuth, meetings: readonly BackendMeeting[]): Promise<Map<string, string>> {
  const unique = new Map(meetings.filter((m) => m.subjectId).map((m) => [m.subjectId as string, m.subjectType]))
  const loaded = await Promise.all(
    [...unique].map(async ([id, type]) => {
      const path = type === "deal" ? `/api/v1/sales/deals/${encodeURIComponent(id)}/` : `/api/v1/customers/${encodeURIComponent(id)}/`
      const item = await apiRequest(path, { auth, schema: type === "deal" ? titleSchema : nameSchema }).catch(() => null)
      return item ? ([id, "title" in item ? item.title : item.name] as const) : null
    })
  )
  return new Map(loaded.filter((entry) => entry !== null))
}

export function toMeeting(meeting: BackendMeeting, nameOf: (id: string) => string, subjects: Map<string, string>, now: number): Meeting {
  const host = meeting.hostUserId ?? meeting.ownerUserId
  const booked = meeting.bookedByUserId ?? meeting.ownerUserId
  const isScheduled = meeting.status === "scheduled"
  // Ссылка ведёт в карточку сделки; встреча с клиентом без сделки показывает своё название
  const lead =
    meeting.subjectType === "deal" && meeting.subjectId
      ? { id: meeting.subjectId, name: subjects.get(meeting.subjectId) ?? meeting.title }
      : { id: "", name: (meeting.subjectId && subjects.get(meeting.subjectId)) || meeting.title }
  return {
    id: meeting.id,
    startsAt: meeting.scheduledStart,
    endsAt: meeting.scheduledEnd,
    lead,
    format: meeting.format,
    location: meeting.location,
    host: { id: host, name: nameOf(host) },
    bookedBy: { id: booked, name: nameOf(booked) },
    status: isScheduled && meeting.confirmedAt ? "confirmed" : meeting.status,
    // Отправку подтверждения клиенту backend не хранит: известно только, подтвердил ли он
    clientConfirmation: meeting.confirmedAt ? "confirmed" : "not_confirmed",
    outcomeRequired: isScheduled && Date.parse(meeting.scheduledEnd) < now,
    notes: meeting.description,
    outcomeComment: meeting.outcome,
  }
}

type BackendMeetingsQuery = Record<string, string | number | undefined>

/**
 * Все страницы ответа. Нужно, когда отбор уточняется по полям ответа: иначе счётчик
 * зависел бы от размера страницы. Ограничение — только защита от бесконечного цикла.
 */
export async function fetchAllMeetings(auth: ApiAuth, query: BackendMeetingsQuery): Promise<BackendMeeting[]> {
  const all: BackendMeeting[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const chunk = await apiRequest("/api/v1/meetings/", {
      auth,
      query: { ...query, limit: PAGE_LIMIT_MAX, offset: all.length },
      schema: backendMeetingsPageSchema,
    })
    all.push(...chunk.results)
    if (all.length >= chunk.count || chunk.results.length === 0) return all
  }
  throw new ApiError("server", "Слишком много встреч для отбора — сузьте период или выберите сотрудника.")
}

/** 50 страниц по PAGE_LIMIT_MAX — заведомо больше встреч отдела за всё время работы */
const MAX_PAGES = 50

/**
 * `GET /meetings/`: видимость, поиск (`search`) и «без итога» (`outcome_required`) решает backend.
 * «Подтверждена» — запланированные встречи, уточнённые по полям ответа: для неё загружаются все
 * страницы, поэтому список и счётчик полные, а не первые N встреч.
 */
const httpMeetingsRepository: MeetingsRepository = {
  async listMeetings({ period, status, hostId, leadId, search, outcomeRequired, limit, offset }) {
    const auth = await getRenderAuth()
    // «Подтверждена» — запланированная с отметкой подтверждения: уточняется по ответу (все страницы)
    const refined = status === "confirmed"
    const range = outcomeRequired ? null : period ? PERIOD_RANGE[period] : null
    const query: BackendMeetingsQuery = {
      status: refined ? "scheduled" : outcomeRequired ? undefined : (status ?? undefined),
      // Встречи без итога отбирает backend: запланированные, время которых уже прошло
      outcomeRequired: outcomeRequired ? "true" : undefined,
      search: search ?? undefined,
      ownerId: hostId ?? undefined,
      ...(leadId ? { subjectType: "deal", subjectId: leadId } : {}),
      dateFrom: range && range[0] !== null ? companyDay(range[0]) : undefined,
      dateTo: range ? companyDay(range[1]) : undefined,
    }
    const nameOf = await loadPeopleNames()
    const now = Date.now()
    if (!refined) {
      const page = await apiRequest("/api/v1/meetings/", { auth, query: { ...query, limit, offset }, schema: backendMeetingsPageSchema })
      const subjects = await subjectNames(auth, page.results)
      return { count: page.count, results: page.results.map((meeting) => toMeeting(meeting, nameOf, subjects, now)) }
    }
    const matching = (await fetchAllMeetings(auth, query)).filter((meeting) => meeting.confirmedAt !== null)
    const visible = matching.slice(offset, offset + limit)
    const subjects = await subjectNames(auth, visible)
    return { count: matching.length, results: visible.map((meeting) => toMeeting(meeting, nameOf, subjects, now)) }
  },
}

/** `PATCH /meetings/{id}/` — заметка и место; время меняется только переносом */
export async function updateMeeting(auth: ApiAuth, meetingId: string, changes: { description: string; location: string }): Promise<void> {
  await apiRequest(`/api/v1/meetings/${encodeURIComponent(meetingId)}/`, { method: "PATCH", auth, body: changes, schema: z.unknown() })
}

/** `POST /meetings/{id}/confirm/` — подтверждено вручную после звонка клиенту (кто и когда — фиксирует backend) */
export async function confirmMeeting(auth: ApiAuth, meetingId: string): Promise<void> {
  await apiRequest(`/api/v1/meetings/${encodeURIComponent(meetingId)}/confirm/`, { method: "POST", auth, body: { source: "manual" }, schema: z.unknown() })
}

/** `POST /meetings/{id}/reschedule/` — новая дата для запланированной встречи */
export async function rescheduleMeeting(auth: ApiAuth, meetingId: string, start: string, durationMinutes: number): Promise<void> {
  const begin = new Date(start)
  await apiRequest(`/api/v1/meetings/${encodeURIComponent(meetingId)}/reschedule/`, {
    method: "POST",
    auth,
    body: { scheduledStart: begin.toISOString(), scheduledEnd: new Date(begin.getTime() + durationMinutes * 60_000).toISOString() },
    schema: z.unknown(),
  })
}

/** `POST /meetings/{id}/cancel/` — отмена до встречи с обязательной причиной */
export async function cancelMeeting(auth: ApiAuth, meetingId: string, reason: string): Promise<void> {
  await apiRequest(`/api/v1/meetings/${encodeURIComponent(meetingId)}/cancel/`, { method: "POST", auth, body: { reason }, schema: z.unknown() })
}

export type NewMeeting = {
  /** Встреча по сделке или с клиентом (из карточки клиента) */
  subject: { type: "deal" | "customer"; id: string }
  title: string
  startsAt: string
  durationMinutes: number
  format: Meeting["format"]
  location: string | null
  hostId: string
  notes: string | null
}

/** `POST /meetings/` — встреча по сделке или с клиентом. Пересечения и права проверяет backend */
export async function createMeeting(auth: ApiAuth, meeting: NewMeeting): Promise<void> {
  const start = new Date(meeting.startsAt)
  await apiRequest("/api/v1/meetings/", {
    method: "POST",
    auth,
    body: {
      title: meeting.title,
      scheduledStart: start.toISOString(),
      scheduledEnd: new Date(start.getTime() + meeting.durationMinutes * 60_000).toISOString(),
      subjectType: meeting.subject.type,
      subjectId: meeting.subject.id,
      format: meeting.format,
      hostUserId: meeting.hostId,
      ...(meeting.location ? { location: meeting.location } : {}),
      ...(meeting.notes ? { description: meeting.notes } : {}),
    },
    schema: z.unknown(),
  })
}

export type MeetingOutcome = {
  result: "held" | "no_show" | "rescheduled"
  /** ISO; только для переноса */
  newStart: string | null
  durationMinutes: number
  comment: string | null
  /** Причина неявки — для аналитики «Потери» */
  reason?: string | null
  /** Следующий шаг после состоявшейся встречи (задача по сделке) */
  nextStep?: { title: string; dueDate: string } | null
}

/** `POST /meetings/{id}/outcome/` — итог; перенос сразу получает новую дату */
export async function recordMeetingOutcome(auth: ApiAuth, meetingId: string, outcome: MeetingOutcome): Promise<void> {
  const start = outcome.newStart ? new Date(outcome.newStart) : null
  await apiRequest(`/api/v1/meetings/${encodeURIComponent(meetingId)}/outcome/`, {
    method: "POST",
    auth,
    body: {
      outcome: outcome.result,
      ...(start
        ? { newStart: start.toISOString(), newEnd: new Date(start.getTime() + outcome.durationMinutes * 60_000).toISOString() }
        : {}),
      ...(outcome.comment ? { comment: outcome.comment } : {}),
      ...(outcome.result === "no_show" && outcome.reason ? { reason: outcome.reason } : {}),
      ...(outcome.result === "held" && outcome.nextStep ? { nextStep: outcome.nextStep } : {}),
    },
    schema: z.unknown(),
  })
}

export const meetingsRepository: MeetingsRepository = isMockDataSource
  ? mockMeetingsRepository
  : httpMeetingsRepository
