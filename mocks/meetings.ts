/**
 * ДЕМО-ДАННЫЕ встреч. Клиенты — демо-лиды из mocks/crm.ts, даты — от демо-сегодня.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { Meeting } from "@/features/meetings/schemas"
import { demoDeals } from "@/mocks/crm"
import { demoAt, demoHeadOfSales, demoManagers, type DemoPerson } from "@/mocks/team"

type Person = 0 | 1 | 2 | 3 | 4 | 5 | "rop"

type DemoMeetingRow = [
  id: string,
  leadId: string,
  dayOffset: number,
  time: string,
  durationMin: number,
  format: Meeting["format"],
  host: Person,
  bookedBy: Person,
  status: Meeting["status"],
  confirmation: Meeting["clientConfirmation"],
  outcomeRequired: boolean,
  notes: string | null,
  outcomeComment: string | null,
]

const OFFICE = "Офис, ул. Демо, 1, переговорная 2"

const rows: DemoMeetingRow[] = [
  // Вчера и раньше
  ["mt-01", "lead-f-04", -6, "15:00", 60, "office", 0, 0, "held", "confirmed", false, "Пришла с мужем, интересует срок 6 месяцев", "Понравилось предложение, решают вместе с мужем"],
  ["mt-02", "lead-f-07", -1, "14:30", 60, "office", 3, 3, "held", "confirmed", false, null, "Готов оплатить, ждёт реквизиты"],
  ["mt-03", "lead-f-10", -1, "12:00", 45, "office", 0, "rop", "scheduled", "confirmed", true, null, null],
  ["mt-04", "lead-f-02", -1, "10:00", 60, "visit", 1, 1, "held", "confirmed", false, "Выезд в офис клиента", "Запросили договор на согласование юристу"],
  ["mt-05", "lead-s-12", -2, "16:00", 60, "online", 2, 2, "held", "confirmed", false, null, "Нужен расчёт стоимости по двум вариантам"],
  ["mt-06", "lead-s-07", -1, "11:00", 45, "office", 0, 0, "rescheduled", "not_confirmed", false, "Клиент попросил перенести", "Новую дату пока не назначили"],
  ["mt-07", "lead-s-08", -1, "17:00", 45, "office", 4, 4, "no_show", "not_confirmed", false, null, "Не пришёл и не отвечает на звонки"],
  ["mt-08", "lead-f-11", -4, "13:00", 60, "office", 4, 4, "held", "confirmed", false, null, "Обещал подумать"],
  // Сегодня
  ["mt-09", "lead-s-02", 0, "10:00", 45, "online", 2, 2, "held", "confirmed", false, null, "Хочет продлить на тех же условиях"],
  ["mt-10", "lead-s-13", 0, "11:30", 60, "office", 1, 1, "scheduled", "confirmed", true, null, null],
  ["mt-11", "lead-s-09", 0, "15:00", 60, "office", 0, "rop", "confirmed", "confirmed", false, "Клиент по рекомендации, подготовить кейсы", null],
  ["mt-12", "lead-s-03", 0, "17:00", 60, "office", 0, 0, "scheduled", "not_sent", false, null, null],
  ["mt-13", "lead-s-10", 0, "18:30", 45, "online", 2, 5, "confirmed", "confirmed", false, "Ссылку на видеозвонок отправить за час", null],
  ["mt-14", "lead-n-08", 0, "16:00", 45, "online", 2, 2, "scheduled", "not_confirmed", false, null, null],
  // Завтра и на неделе
  ["mt-15", "lead-s-04", 1, "11:00", 45, "online", 1, 1, "scheduled", "not_sent", false, null, null],
  ["mt-16", "lead-s-11", 1, "12:00", 60, "office", 3, 3, "confirmed", "confirmed", false, null, null],
  ["mt-17", "lead-s-05", 1, "15:30", 60, "office", 3, "rop", "scheduled", "not_confirmed", false, "Уточнить бюджет до встречи", null],
  ["mt-18", "lead-s-06", 2, "10:00", 45, "online", 5, 5, "scheduled", "not_sent", false, null, null],
  ["mt-19", "lead-f-05", 3, "14:00", 60, "office", 0, 0, "scheduled", "not_sent", false, "Повторная встреча после зарплаты", null],
  ["mt-20", "lead-s-14", 4, "11:00", 60, "visit", 3, 3, "scheduled", "not_sent", false, null, null],
]

function personFor(person: Person): DemoPerson {
  return person === "rop" ? demoHeadOfSales : demoManagers[person]
}

const leadNames = new Map(demoDeals.map((deal) => [deal.id, deal.title]))

function addMinutes(iso: string, minutes: number): string {
  const date = new Date(new Date(iso).getTime() + minutes * 60_000)
  // В демо все встречи в часовом поясе компании (UTC+6)
  return new Date(date.getTime() + 6 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "+06:00")
}

function toMeeting([id, leadId, dayOffset, time, duration, format, host, bookedBy, status, confirmation, outcomeRequired, notes, outcomeComment]: DemoMeetingRow): Meeting {
  const startsAt = demoAt(dayOffset, time)
  return {
    id,
    startsAt,
    endsAt: addMinutes(startsAt, duration),
    lead: { id: leadId, name: leadNames.get(leadId) ?? leadId },
    format,
    location: format === "office" ? OFFICE : format === "visit" ? "У клиента" : null,
    host: personFor(host),
    bookedBy: personFor(bookedBy),
    status,
    clientConfirmation: confirmation,
    outcomeRequired,
    notes,
    outcomeComment,
  }
}

export const demoMeetings: Meeting[] = rows.map(toMeeting)
