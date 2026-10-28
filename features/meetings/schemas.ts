import { z } from "zod"

/** Предлагаемая форма встречи. НЕ согласована с backend — см. docs/API_CONTRACT.md. */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const meetingStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "held",
  "no_show",
  "rescheduled",
  "cancelled",
])

/** Строка «Клиенту»: отправлено ли клиенту подтверждение и ответил ли он */
export const clientConfirmationSchema = z.enum(["confirmed", "not_confirmed", "not_sent"])

export const meetingFormatSchema = z.enum(["office", "online", "visit"])

/** Периоды, которые понимает backend; границы дней считаются в часовом поясе компании */
export const meetingPeriodSchema = z.enum(["yesterday", "today", "tomorrow", "week"])

export const meetingSchema = z.object({
  id: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  lead: refSchema,
  format: meetingFormatSchema,
  location: z.string().nullable(),
  /** «Проводит» */
  host: refSchema,
  /** «Назначил(а)» */
  bookedBy: refSchema,
  status: meetingStatusSchema,
  clientConfirmation: clientConfirmationSchema,
  /** Встреча прошла, а итог не записан — флаг ставит backend по правилам компании */
  outcomeRequired: z.boolean(),
  notes: z.string().nullable(),
  outcomeComment: z.string().nullable(),
})

export const meetingOutcomeFormSchema = z
  .object({
    result: z.enum(["held", "no_show", "rescheduled"]),
    rescheduledTo: z.string(),
    comment: z.string().trim().max(2000, "Не длиннее 2000 символов"),
  })
  .refine((value) => value.result !== "rescheduled" || value.rescheduledTo.length > 0, {
    message: "Укажите новую дату встречи",
    path: ["rescheduledTo"],
  })

export const meetingFormSchema = z.object({
  leadId: z.string({ error: "Выберите клиента" }).min(1, "Выберите клиента"),
  startsAt: z.string().min(1, "Укажите дату и время"),
  format: meetingFormatSchema,
  location: z.string().trim().max(300, "Не длиннее 300 символов"),
  hostId: z.string().min(1, "Выберите, кто проводит встречу"),
  notes: z.string().trim().max(2000, "Не длиннее 2000 символов"),
})

export type MeetingStatus = z.infer<typeof meetingStatusSchema>
export type ClientConfirmation = z.infer<typeof clientConfirmationSchema>
export type MeetingFormat = z.infer<typeof meetingFormatSchema>
export type MeetingPeriod = z.infer<typeof meetingPeriodSchema>
export type Meeting = z.infer<typeof meetingSchema>
export type MeetingOutcomeFormValues = z.infer<typeof meetingOutcomeFormSchema>
export type MeetingFormValues = z.infer<typeof meetingFormSchema>
