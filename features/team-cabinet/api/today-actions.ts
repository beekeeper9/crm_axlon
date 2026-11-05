import { z } from "zod"

import { loadPeopleNames } from "@/features/team"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * «Что делать сегодня» (ТЗ 14.2, 14.3, 14.10/14.16, 17.3): `GET /team/today/?include=actions`.
 * Группы, правила, счётчики и суммы считает backend по правилам, без ИИ; отдел РОПа и права —
 * тоже он. Суммы — по валютам, без сложения разных валют.
 */

export const TODAY_ACTION_KINDS = [
  "payments_to_verify",
  "overdue_tasks",
  "tasks_due_soon",
  "meetings_without_outcome",
  "deals_without_next_step",
  "deals_to_push",
  "leads_without_contact",
  "managers_without_activity",
  // Только в «Фокусе» менеджера (`/team/my-focus/`)
  "miss_tasks",
  "debts_to_collect",
] as const

export type TodayActionKind = (typeof TODAY_ACTION_KINDS)[number]

export function isTodayActionKind(kind: string): kind is TodayActionKind {
  return (TODAY_ACTION_KINDS as readonly string[]).includes(kind)
}

const actionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  managerId: z.string().nullable(),
  managerUsername: z.string().default(""),
  amount: decimalStringSchema.nullable().default(null),
  currency: currencyCodeSchema.nullable().default(null),
  /** Срок задачи или дата оплаты */
  date: z.iso.date().nullable().default(null),
  /** Начало встречи, время записи оплаты, время прихода лида */
  at: z.iso.datetime({ offset: true }).nullable().default(null),
  ageDays: z.int().nonnegative().nullable().default(null),
  subjectType: z.string().nullable().default(null),
  subjectId: z.string().nullable().default(null),
  reasons: z.array(z.string()).default([]),
  /** Подтверждённые оплаты в валюте сделки (только «дожим») */
  paid: decimalStringSchema.nullable().default(null),
  debt: decimalStringSchema.nullable().default(null),
  stageName: z.string().nullable().default(null),
})

const actionGroupSchema = z.object({
  /** Неизвестный код новой версии backend не ломает блок — он покажется без ссылки */
  kind: z.string(),
  priority: z.int(),
  title: z.string(),
  rule: z.string(),
  count: z.int().nonnegative(),
  amounts: z.array(z.object({ currency: currencyCodeSchema, total: decimalStringSchema })).default([]),
  byManager: z.array(z.object({ userId: z.string(), username: z.string(), count: z.int().nonnegative() })).default([]),
  items: z.array(actionItemSchema),
})

const todayActionsSchema = z.object({
  date: z.iso.date(),
  asOf: z.iso.datetime({ offset: true }),
  limit: z.int().positive(),
  departmentId: z.string().nullable().default(null),
  thresholds: z.object({ stalledDealDays: z.int(), leadResponseMinutes: z.int() }),
  total: z.int().nonnegative(),
  groups: z.array(actionGroupSchema),
})

const responseSchema = z.object({ actions: todayActionsSchema })

type Named<T> = T & { managerName: string | null }

export type TodayActionItem = Named<z.infer<typeof actionItemSchema>>
export type TodayActionGroup = Omit<z.infer<typeof actionGroupSchema>, "items" | "byManager"> & {
  items: TodayActionItem[]
  byManager: { userId: string; name: string; count: number }[]
}
export type TodayActions = Omit<z.infer<typeof todayActionsSchema>, "groups"> & { groups: TodayActionGroup[] }

/** Сколько строк показываем в каждой группе */
export const TODAY_ACTIONS_LIMIT = 5

/** Имя сотрудника из справочника; логин — если имени не видно */
function nameWith(nameOf: (id: string) => string) {
  return (userId: string, username: string) => {
    const name = nameOf(userId)
    return name === "Сотрудник" ? username || name : name
  }
}

/** Сколько строк группы показываем в развёрнутом списке (максимум backend) */
export const TODAY_ACTIONS_LIMIT_MAX = 50

function withNames(actions: z.infer<typeof todayActionsSchema>, nameOf: (id: string) => string): TodayActions {
  const name = nameWith(nameOf)
  return {
    ...actions,
    groups: [...actions.groups]
      .sort((a, b) => a.priority - b.priority)
      .map((group) => ({
        ...group,
        byManager: group.byManager.map((row) => ({ userId: row.userId, name: name(row.userId, row.username), count: row.count })),
        items: group.items.map((item) => ({
          ...item,
          managerName: item.managerId ? name(item.managerId, item.managerUsername) : null,
        })),
      })),
  }
}

/**
 * «Фокус» менеджера: `GET /team/my-focus/` — его собственные записи по тем же правилам, плюс
 * задачи по проколам (первыми) и долги к сбору. Порядок групп задаёт backend.
 */
export async function fetchMyFocus(limit: number = TODAY_ACTIONS_LIMIT_MAX): Promise<TodayActions> {
  const [actions, nameOf] = await Promise.all([
    apiRequest("/api/v1/team/my-focus/", { auth: await getRenderAuth(), query: { actionsLimit: limit }, schema: todayActionsSchema }),
    loadPeopleNames(),
  ])
  return withNames(actions, nameOf)
}

export async function fetchTodayActions(departmentId?: string | null, limit: number = TODAY_ACTIONS_LIMIT): Promise<TodayActions> {
  const [response, nameOf] = await Promise.all([
    apiRequest("/api/v1/team/today/", {
      auth: await getRenderAuth(),
      query: { include: "actions", actionsLimit: limit, departmentId: departmentId ?? undefined },
      schema: responseSchema,
    }),
    loadPeopleNames(),
  ])
  return withNames(response.actions, nameOf)
}
