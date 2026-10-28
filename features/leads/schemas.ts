import { z } from "zod"

import { pipelineStageSchema } from "@/features/sales"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * ПРЕДЛАГАЕМАЯ модель карточки лида. НЕ согласована с backend:
 * какие поля обязательны, а какие настраивает компания — открытый вопрос (docs/API_CONTRACT.md).
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const leadOptionSchema = refSchema

export const leadDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  client: z.object({
    name: z.string(),
    phones: z.array(z.string()),
    email: z.string().nullable(),
    city: z.string().nullable(),
  }),
  pipeline: z.object({ id: z.string(), name: z.string(), stages: z.array(pipelineStageSchema) }),
  stageId: z.string(),
  manager: refSchema,
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  source: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  stageEnteredAt: z.iso.datetime({ offset: true }),
  tags: z.array(z.string()),
  nextAction: z
    .object({ title: z.string(), dueAt: z.iso.datetime({ offset: true }).nullable(), isOverdue: z.boolean() })
    .nullable(),
  /** «Что по сделке?» — сводка ИИ по истории лида; null, если ИИ не подключён или данных мало */
  aiContext: z
    .object({
      summary: z.string(),
      nextSteps: z.array(z.string()),
      generatedAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  /** Оплата по сделке; суммы считает backend */
  payment: z
    .object({
      total: decimalStringSchema,
      paid: decimalStringSchema,
      remaining: decimalStringSchema,
      currency: currencyCodeSchema,
      items: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["prepayment", "additional", "full"]),
          amount: decimalStringSchema,
          paidDate: z.iso.date(),
        })
      ),
    })
    .nullable(),
  /** Поля, которые компания настроила для лида: подпись и значение */
  customFields: z.array(z.object({ id: z.string(), label: z.string(), value: z.string().nullable() })),
  /** Другие сделки этого клиента */
  related: z.array(z.object({ id: z.string(), title: z.string(), pipelineName: z.string(), stageName: z.string() })),
})

export const activityKindSchema = z.enum(["call", "chat", "note", "stage", "task", "meeting", "payment"])

export const leadActivitySchema = z.object({
  id: z.string(),
  at: z.iso.datetime({ offset: true }),
  kind: activityKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  author: z.string().nullable(),
})

export type LeadOption = z.infer<typeof leadOptionSchema>
export type LeadDetail = z.infer<typeof leadDetailSchema>
export type ActivityKind = z.infer<typeof activityKindSchema>
export type LeadActivity = z.infer<typeof leadActivitySchema>
