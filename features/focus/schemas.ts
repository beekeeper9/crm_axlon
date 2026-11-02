import { z } from "zod"

import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Данные «Фокуса». В режиме api их собирает focus-repository из `GET /operations/findings/`.
 * Какие записи попадают в фокус и почему — решает backend (правила компании);
 * frontend только показывает группы, причины и (если есть) рекомендации.
 */

export const focusPrioritySchema = z.enum(["high", "medium", "low"])

export const focusItemSchema = z.object({
  id: z.string(),
  lead: z.object({ id: z.string(), name: z.string() }),
  /** Куда ведёт строка; null — карточка сделки по lead.id */
  href: z.string().nullable().default(null),
  pipelineName: z.string(),
  stageName: z.string(),
  /** null — backend приоритет не задаёт (правила дают только причину и возраст) */
  priority: focusPrioritySchema.nullable(),
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
  /** Сумма сделки, если известна (десятичная строка + валюта) */
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
})

export const focusGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  tone: z.enum(["urgent", "warm", "neutral"]),
  items: z.array(focusItemSchema),
})

export const focusListSchema = z.object({
  /** Сколько клиентов ждут ответа; null — источник (чаты) не подключён */
  awaitingReply: z.int().nonnegative().nullable(),
  /** Backend отдал не все записи (ограничение размера ответа) */
  truncated: z.boolean().default(false),
  /** Менеджеры для фильтра руководителя, с количеством лидов в фокусе */
  managers: z.array(z.object({ id: z.string(), name: z.string(), count: z.int().nonnegative() })),
  groups: z.array(focusGroupSchema),
})

export type FocusPriority = z.infer<typeof focusPrioritySchema>
export type FocusItem = z.infer<typeof focusItemSchema>
export type FocusGroup = z.infer<typeof focusGroupSchema>
export type FocusList = z.infer<typeof focusListSchema>
