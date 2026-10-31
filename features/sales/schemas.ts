import { z } from "zod"

import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Данные «Продаж» в форме интерфейса. В режиме api их собирает из ответов backend
 * `features/sales/api/sales-repository.ts` (контракт — docs/API_CONTRACT.md, раздел «Продажи»).
 * Воронки и этапы приходят из настроек компании: в компонентах нет списка этапов.
 * Сделка в этой CRM — это лид в воронке, поэтому её карточка открывается как карточка лида.
 */

export const personRefSchema = z.object({ id: z.string(), name: z.string() })

/** open — рабочий этап; won и lost — закрытие сделки */
export const stageKindSchema = z.enum(["open", "won", "lost"])

export const pipelineStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: stageKindSchema,
})

export const pipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  stages: z.array(pipelineStageSchema).min(1),
})

/** Настройки воронок компании и справочник причин отказа */
export const salesConfigSchema = z.object({
  pipelines: z.array(pipelineSchema),
  lossReasons: z.array(z.object({ id: z.string(), label: z.string() })),
})

export const dealSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** null — клиент не привязан или backend не отдаёт его в списке сделок */
  client: z.object({ name: z.string(), phone: z.string().nullable() }).nullable(),
  pipelineId: z.string(),
  stageId: z.string(),
  /** Деньги — десятичная строка и ISO-код валюты; null — сумма ещё не известна */
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  manager: personRefSchema,
  nextAction: z
    .object({
      title: z.string(),
      dueAt: z.iso.datetime({ offset: true }).nullable(),
      /** Просрочку считает backend */
      isOverdue: z.boolean(),
    })
    .nullable(),
  /** null — backend не отдаёт дату в списке сделок */
  stageEnteredAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  tags: z.array(z.string()),
})

export const boardColumnSchema = z.object({
  stageId: z.string(),
  /** Сколько сделок на этапе всего (с учётом фильтров), даже если пришла только часть */
  count: z.int().nonnegative(),
  /** Сумма по этапу считается на backend; null — суммы разных валют или нет данных */
  totalAmount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  deals: z.array(dealSchema),
})

export const boardSchema = z.object({
  pipelineId: z.string(),
  columns: z.array(boardColumnSchema),
})

export type PersonRef = z.infer<typeof personRefSchema>
export type StageKind = z.infer<typeof stageKindSchema>
export type PipelineStage = z.infer<typeof pipelineStageSchema>
export type Pipeline = z.infer<typeof pipelineSchema>
export type SalesConfig = z.infer<typeof salesConfigSchema>
export type LossReason = SalesConfig["lossReasons"][number]
export type Deal = z.infer<typeof dealSchema>
export type BoardColumn = z.infer<typeof boardColumnSchema>
export type Board = z.infer<typeof boardSchema>
