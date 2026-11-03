import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { backendRoleSchema, uiRoleFromBackend } from "@/lib/permissions/backend-roles"
import type { Role } from "@/lib/permissions/roles"

/**
 * Профиль сотрудника (прежде всего уволенного) и работа с его базой — только режим api.
 * Данные: `GET /staff/{id}/` (история работы по видам), лиды, клиенты и сделки по владельцу,
 * задачи по исполнителю. Права и область (директор — компания, РОП — свой отдел) решает backend.
 */

const historySchema = z.record(z.string(), z.int().nonnegative())

const memberDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  login: z.string(),
  fullName: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: backendRoleSchema,
  department: z.object({ id: z.string(), name: z.string() }).nullable(),
  status: z.enum(["active", "invited", "deactivated"]),
  lastLogin: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  history: historySchema,
  hasHistory: z.boolean(),
  canDelete: z.boolean(),
})

export type MemberDetail = Omit<z.infer<typeof memberDetailSchema>, "role"> & { role: Role }

export async function fetchMemberDetail(auth: ApiAuth, membershipId: string): Promise<MemberDetail> {
  const detail = await apiRequest(`/api/v1/staff/${encodeURIComponent(membershipId)}/`, { auth, schema: memberDetailSchema })
  return { ...detail, role: uiRoleFromBackend(detail.role) }
}

/** `DELETE /staff/{id}/` — только аккаунт без истории работы (иначе 409 `has_history`) */
export async function deleteMember(auth: ApiAuth, membershipId: string): Promise<void> {
  await apiRequest(`/api/v1/staff/${encodeURIComponent(membershipId)}/`, { method: "DELETE", auth, schema: z.unknown() })
}

/** `PATCH /staff/{id}/` — прикрепить сотрудника к отделу (директор) */
export async function assignMemberDepartment(auth: ApiAuth, membershipId: string, departmentId: string): Promise<void> {
  await apiRequest(`/api/v1/staff/${encodeURIComponent(membershipId)}/`, { method: "PATCH", auth, body: { departmentId }, schema: z.unknown() })
}

export const formerLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  status: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
})

export const formerCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  archivedAt: z.iso.datetime({ offset: true }).nullable().optional(),
})

export const formerDealSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "won", "lost"]),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  createdAt: z.iso.datetime({ offset: true }),
})

export const formerTaskSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  taskStatus: z.enum(["open", "completed", "cancelled"]),
  dueDate: z.iso.date().nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  result: z.string().nullable(),
})

export type FormerLead = z.infer<typeof formerLeadSchema>
export type FormerCustomer = z.infer<typeof formerCustomerSchema>
export type FormerDeal = z.infer<typeof formerDealSchema>
export type FormerTask = z.infer<typeof formerTaskSchema>

/** Все страницы списка (лимит страниц — защита от бесконечного цикла) */
async function fetchAll<T extends z.ZodType>(auth: ApiAuth, path: string, query: Record<string, string>, item: T): Promise<z.infer<T>[]> {
  const all: z.infer<T>[] = []
  for (let page = 0; page < 50; page += 1) {
    const chunk = await apiRequest(path, { auth, query: { ...query, limit: PAGE_LIMIT_MAX, offset: all.length }, schema: paginatedSchema(item) })
    all.push(...chunk.results)
    if (all.length >= chunk.count || chunk.results.length === 0) break
  }
  return all
}

export type FormerBase = { leads: FormerLead[]; customers: FormerCustomer[]; deals: FormerDeal[]; tasks: FormerTask[] }

/** База сотрудника: его лиды, клиенты, сделки (все статусы) и задачи */
export async function fetchFormerBase(auth: ApiAuth, userId: string): Promise<FormerBase> {
  const [leads, customers, deals, tasks] = await Promise.all([
    fetchAll(auth, "/api/v1/leads/", { ownerId: userId, ordering: "-created_at" }, formerLeadSchema),
    fetchAll(auth, "/api/v1/customers/", { ownerId: userId, archived: "all" }, formerCustomerSchema),
    fetchAll(auth, "/api/v1/sales/deals/", { managerId: userId, ordering: "-created_at" }, formerDealSchema),
    fetchAll(auth, "/api/v1/activities/", { kind: "task", assigneeId: userId }, formerTaskSchema),
  ])
  return { leads, customers, deals, tasks }
}

export const RECORD_KINDS = ["lead", "customer", "deal"] as const
export type RecordKind = (typeof RECORD_KINDS)[number]

const ASSIGN_PATH: Record<RecordKind, (id: string) => string> = {
  lead: (id) => `/api/v1/leads/${encodeURIComponent(id)}/assign/`,
  customer: (id) => `/api/v1/customers/${encodeURIComponent(id)}/assign/`,
  deal: (id) => `/api/v1/sales/deals/${encodeURIComponent(id)}/assign/`,
}

/** Передать запись другому сотруднику; история (кто владел раньше) сохраняется в аудите backend */
export async function assignRecord(auth: ApiAuth, kind: RecordKind, id: string, ownerUserId: string): Promise<void> {
  await apiRequest(ASSIGN_PATH[kind](id), { method: "POST", auth, body: { ownerUserId }, schema: z.unknown() })
}

/** Лиды сотрудника в CSV (для скачивания базы) */
export function leadsToCsv(leads: readonly FormerLead[]): string {
  const escape = (value: string | null) => {
    const text = value ?? ""
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = ["Имя", "Телефон", "E-mail", "Источник", "Статус", "Создан"]
  const rows = leads.map((lead) => [lead.name, lead.phone, lead.email, lead.source, lead.status, lead.createdAt.slice(0, 10)].map(escape).join(","))
  // BOM — чтобы Excel открыл кириллицу без вопросов о кодировке
  return `﻿${[header.join(","), ...rows].join("\r\n")}\r\n`
}
