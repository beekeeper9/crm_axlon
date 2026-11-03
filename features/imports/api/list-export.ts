import { z } from "zod"

import { fetchStaff } from "@/features/departments/api/department-analytics"
import { PROSPECT_SOURCE_LABELS, PROSPECT_STATUS_META } from "@/features/prospects/lib/prospect-meta"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { paginatedSchema } from "@/lib/api/pagination"

/** Наибольшая страница списков backend */
const PAGE_LIMIT = 200
/** Больше строк в один файл не собираем: сервер интерфейса держит выгрузку в памяти */
export const MAX_EXPORT_ROWS = 5000

type Query = Record<string, string | undefined>

async function fetchAllPages<T>(auth: ApiAuth, path: string, query: Query, item: z.ZodType<T>): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = []
  let total = 0
  for (let offset = 0; offset < MAX_EXPORT_ROWS; offset += PAGE_LIMIT) {
    const page = await apiRequest(path, { auth, query: { ...query, limit: String(PAGE_LIMIT), offset: String(offset) }, schema: paginatedSchema(item) })
    total = page.count
    rows.push(...page.results)
    if (rows.length >= total || page.results.length === 0) break
  }
  return { rows: rows.slice(0, MAX_EXPORT_ROWS), total }
}

/** Имена ответственных; менеджеру список сотрудников недоступен — тогда колонка остаётся без имён */
async function ownerNames(auth: ApiAuth): Promise<Map<string, string>> {
  try {
    return new Map((await fetchStaff(auth)).map((member) => [member.userId, member.name]))
  } catch (error) {
    if (error instanceof ApiError && (error.kind === "forbidden" || error.kind === "not_found")) return new Map()
    throw error
  }
}

function escapeCell(value: string | null | undefined): string {
  const text = value ?? ""
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** «;» и BOM — так Excel в русской локали сразу раскладывает колонки и читает кириллицу */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | null | undefined)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(";"))
  return `﻿${lines.join("\r\n")}\r\n`
}

const customerSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  ownerUserId: z.string(),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string(),
})

const CUSTOMER_ARCHIVED: Record<string, string> = { active: "false", archive: "true" }

export type ExportFile = { csv: string; total: number; exported: number }

/** База клиентов с фильтрами списка: q, status (active | archive), manager */
export async function exportCustomers(auth: ApiAuth, params: URLSearchParams): Promise<ExportFile> {
  const query: Query = {
    search: params.get("q") ?? undefined,
    ownerId: params.get("manager") ?? undefined,
    archived: CUSTOMER_ARCHIVED[params.get("status") ?? ""] ?? "all",
    ordering: "-created_at",
  }
  const [{ rows, total }, names] = await Promise.all([fetchAllPages(auth, "/api/v1/customers/", query, customerSchema), ownerNames(auth)])
  const csv = toCsv(
    ["Имя", "Телефон", "E-mail", "Ответственный", "В архиве", "Создан"],
    rows.map((c) => [c.name, c.phone, c.email, names.get(c.ownerUserId) ?? "", c.archivedAt ? "да" : "нет", c.createdAt.slice(0, 10)])
  )
  return { csv, total, exported: rows.length }
}

const leadSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  source: z.string(),
  status: z.string(),
  ownerUserId: z.string(),
  createdAt: z.string(),
})

const label = <T extends string>(labels: Record<T, string>, value: string) => (value in labels ? labels[value as T] : value)

/** Входящие лиды с фильтрами списка: q, status, source, owner */
export async function exportLeads(auth: ApiAuth, params: URLSearchParams): Promise<ExportFile> {
  const query: Query = {
    search: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    source: params.get("source") ?? undefined,
    ownerId: params.get("owner") ?? undefined,
  }
  const [{ rows, total }, names] = await Promise.all([fetchAllPages(auth, "/api/v1/leads/", query, leadSchema), ownerNames(auth)])
  const statusLabels = Object.fromEntries(Object.entries(PROSPECT_STATUS_META).map(([key, meta]) => [key, meta.label]))
  const csv = toCsv(
    ["Имя", "Телефон", "E-mail", "Источник", "Статус", "Ответственный", "Создан"],
    rows.map((l) => [l.name, l.phone, l.email, label(PROSPECT_SOURCE_LABELS, l.source), label(statusLabels, l.status), names.get(l.ownerUserId) ?? "", l.createdAt.slice(0, 10)])
  )
  return { csv, total, exported: rows.length }
}
