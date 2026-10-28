import { z } from "zod"

import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Предлагаемая форма очереди «После встречи». НЕ согласована с backend.
 * В какую группу попадает лид, решает backend по правилам компании; frontend только показывает.
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const afterMeetingStateSchema = z.enum(["outcome_required", "no_next_step", "awaiting_decision"])

export const afterMeetingItemSchema = z.object({
  id: z.string(),
  state: afterMeetingStateSchema,
  meeting: z.object({
    id: z.string(),
    startsAt: z.iso.datetime({ offset: true }),
    format: z.enum(["office", "online", "visit"]),
    host: refSchema,
    /** Итог, записанный ранее; null — итога ещё нет */
    outcomeComment: z.string().nullable(),
  }),
  lead: z.object({ id: z.string(), name: z.string(), phone: z.string().nullable() }),
  pipelineName: z.string(),
  stageName: z.string(),
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  nextAction: z.object({ title: z.string(), dueAt: z.iso.datetime({ offset: true }).nullable() }).nullable(),
  /** Подсказка ИИ по лиду после встречи; null — нет или ИИ не подключён */
  aiHint: z.string().nullable(),
})

export const afterMeetingQueueSchema = z.object({
  groups: z.array(
    z.object({
      id: afterMeetingStateSchema,
      title: z.string(),
      description: z.string(),
      items: z.array(afterMeetingItemSchema),
    })
  ),
})

/** Форма обработки: итог (если ещё не записан), договорённости и следующий шаг */
export const afterMeetingFormSchema = z
  .object({
    needsResult: z.boolean(),
    result: z.enum(["held", "no_show", "rescheduled"]).nullable(),
    rescheduledTo: z.string(),
    summary: z.string().trim().max(2000, "Не длиннее 2000 символов"),
    agreements: z.string().trim().max(2000, "Не длиннее 2000 символов"),
    nextTitle: z.string().trim().max(200, "Не длиннее 200 символов"),
    nextDueAt: z.string(),
  })
  .refine((value) => !value.needsResult || value.result !== null, { message: "Выберите, как прошла встреча", path: ["result"] })
  .refine((value) => value.result !== "rescheduled" || value.rescheduledTo.length > 0, {
    message: "Укажите новую дату встречи",
    path: ["rescheduledTo"],
  })
  .refine((value) => value.nextTitle.length === 0 || value.nextDueAt.length > 0, {
    message: "Укажите срок следующего шага",
    path: ["nextDueAt"],
  })

export type AfterMeetingState = z.infer<typeof afterMeetingStateSchema>
export type AfterMeetingItem = z.infer<typeof afterMeetingItemSchema>
export type AfterMeetingQueue = z.infer<typeof afterMeetingQueueSchema>
export type AfterMeetingFormValues = z.infer<typeof afterMeetingFormSchema>
