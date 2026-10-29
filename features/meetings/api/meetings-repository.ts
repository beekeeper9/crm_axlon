import { isMockDataSource } from "@/config/env"
import { meetingSchema, type Meeting, type MeetingPeriod, type MeetingStatus } from "@/features/meetings/schemas"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
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

/** Endpoint не согласован — см. docs/API_CONTRACT.md, раздел «Встречи». */
const httpMeetingsRepository: MeetingsRepository = {
  async listMeetings() {
    return contractPending("список встреч")
  },
}

export const meetingsRepository: MeetingsRepository = isMockDataSource
  ? mockMeetingsRepository
  : httpMeetingsRepository
