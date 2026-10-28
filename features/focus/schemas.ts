import { z } from "zod"

/**
 * Предлагаемая форма данных «Фокуса». НЕ согласована с backend.
 * Какие лиды попадают в фокус и почему — решает backend (правила компании и ИИ);
 * frontend только показывает группы, причины и рекомендации.
 */

export const focusPrioritySchema = z.enum(["high", "medium", "low"])

export const focusItemSchema = z.object({
  id: z.string(),
  lead: z.object({ id: z.string(), name: z.string() }),
  pipelineName: z.string(),
  stageName: z.string(),
  priority: focusPrioritySchema,
  /** Почему лид в фокусе, например «тёплый» с даты пометки */
  reason: z.object({ label: z.string(), since: z.iso.date().nullable() }),
  lastInteraction: z
    .object({
      at: z.iso.datetime({ offset: true }),
      channel: z.enum(["call", "chat", "meeting", "note"]),
      summary: z.string(),
    })
    .nullable(),
  nextAction: z
    .object({ title: z.string(), dueAt: z.iso.datetime({ offset: true }).nullable() })
    .nullable(),
  /** Текст рекомендации ИИ; null — рекомендации нет или ИИ не подключён */
  aiRecommendation: z.string().nullable(),
  manager: z.object({ id: z.string(), name: z.string() }),
})

export const focusGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  tone: z.enum(["urgent", "warm", "neutral"]),
  items: z.array(focusItemSchema),
})

export const focusListSchema = z.object({
  awaitingReply: z.int().nonnegative(),
  /** Менеджеры для фильтра руководителя, с количеством лидов в фокусе */
  managers: z.array(z.object({ id: z.string(), name: z.string(), count: z.int().nonnegative() })),
  groups: z.array(focusGroupSchema),
})

export type FocusPriority = z.infer<typeof focusPrioritySchema>
export type FocusItem = z.infer<typeof focusItemSchema>
export type FocusGroup = z.infer<typeof focusGroupSchema>
export type FocusList = z.infer<typeof focusListSchema>
