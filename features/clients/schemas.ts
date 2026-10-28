import { z } from "zod"

import { stageKindSchema } from "@/features/sales"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Клиент — человек или компания, у которых может быть несколько сделок (лидов), в том числе закрытых.
 * Сделка отвечает на вопрос «что продаём сейчас», клиент — «кто это и что с ним уже было».
 * ПРЕДЛОЖЕНИЕ: отдельной сущности клиента в согласованном контракте пока нет.
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const clientDealSchema = z.object({
  id: z.string(),
  title: z.string(),
  pipelineName: z.string(),
  stageName: z.string(),
  stageKind: stageKindSchema,
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const clientSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  phones: z.array(z.string()),
  email: z.string().nullable(),
  city: z.string().nullable(),
  /** Ответственный за текущую работу с клиентом */
  manager: refSchema.nullable(),
  openDealsCount: z.int().nonnegative(),
  dealsCount: z.int().nonnegative(),
  /** Текущая открытая сделка, если есть */
  currentDeal: z.object({ id: z.string(), stageName: z.string() }).nullable(),
  lastInteractionAt: z.iso.datetime({ offset: true }).nullable(),
})

export const clientDetailSchema = clientSummarySchema.extend({
  deals: z.array(clientDealSchema),
  /** Последние события по всем сделкам клиента */
  recentActivity: z.array(z.object({ id: z.string(), at: z.iso.datetime({ offset: true }), title: z.string(), dealTitle: z.string() })),
})

export type ClientSummary = z.infer<typeof clientSummarySchema>
export type ClientDetail = z.infer<typeof clientDetailSchema>
export type ClientDeal = z.infer<typeof clientDealSchema>
