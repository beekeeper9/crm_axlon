import { z } from "zod"

import {
  catalogSchema,
  companyDetailSchema,
  companySummarySchema,
  createdCompanySchema,
  errorRecordSchema,
  overviewSchema,
  ticketSchema,
  type Catalog,
  type CompanyDetail,
  type CompanyFilters,
  type CompanySummary,
  type CreatedCompany,
  type ErrorRecord,
  type ErrorStatus,
  type Overview,
  type Terms,
  type Ticket,
  type TicketStatus,
} from "@/features/platform/schemas"
import { planUsageSchema, type MetricUsage } from "@/features/plan-limits/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"

/**
 * Панель администратора платформы работает только с backend: в демо-режиме реестра компаний нет.
 * Права проверяет backend (`is_platform_admin`); здесь — только транспорт и проверка формы ответа.
 */

const BASE = "/api/v1/platform"

export function getOverview(auth: ApiAuth, periodDays: number): Promise<Overview> {
  return apiRequest(`${BASE}/overview/`, { auth, query: { periodDays }, schema: overviewSchema })
}

export function getCatalog(auth: ApiAuth): Promise<Catalog> {
  return apiRequest(`${BASE}/catalog/`, { auth, schema: catalogSchema })
}

export function listCompanies(auth: ApiAuth, filters: CompanyFilters, page: PageParams): Promise<Paginated<CompanySummary>> {
  return apiRequest(`${BASE}/companies/`, {
    auth,
    query: { ...filters, ...page },
    schema: paginatedSchema(companySummarySchema),
  })
}

export function getCompany(auth: ApiAuth, companyId: string): Promise<CompanyDetail> {
  return apiRequest(`${BASE}/companies/${encodeURIComponent(companyId)}/`, { auth, schema: companyDetailSchema })
}

export type NewCompanyInput = {
  name: string
  slug: string
  country: string
  currency: string
  timezone: string
  subscription: Terms
  director: { firstName: string; lastName: string; login: string; email: string; phone: string }
}

export function createCompany(auth: ApiAuth, input: NewCompanyInput): Promise<CreatedCompany> {
  return apiRequest(`${BASE}/companies/`, { method: "POST", auth, body: input, schema: createdCompanySchema })
}

/**
 * `POST …/directors/{user_id}/credentials/` — новый временный пароль директора (забыл пароль или
 * не успели передать первые данные). Старый пароль и сессии перестают работать; пароль показывается один раз.
 */
export function issueDirectorCredentials(auth: ApiAuth, companyId: string, userId: string): Promise<{ login: string; temporaryPassword: string }> {
  return apiRequest(`${BASE}/companies/${encodeURIComponent(companyId)}/directors/${encodeURIComponent(userId)}/credentials/`, {
    method: "POST",
    auth,
    schema: z.object({ login: z.string(), temporaryPassword: z.string() }),
  })
}

export function updateCompany(auth: ApiAuth, companyId: string, patch: { name?: string; isActive?: boolean }): Promise<CompanyDetail> {
  return apiRequest(`${BASE}/companies/${encodeURIComponent(companyId)}/`, {
    method: "PATCH",
    auth,
    body: patch,
    schema: companyDetailSchema,
  })
}

export function setSubscription(auth: ApiAuth, companyId: string, terms: Terms): Promise<CompanyDetail> {
  return apiRequest(`${BASE}/companies/${encodeURIComponent(companyId)}/subscription/`, {
    method: "PUT",
    auth,
    body: terms,
    schema: companyDetailSchema,
  })
}

/** Лимиты компании: из тарифа или изменённые платформой; used = null, пока база компании не готова */
export function getCompanyLimits(auth: ApiAuth, companyId: string): Promise<MetricUsage[]> {
  return apiRequest(`${BASE}/companies/${encodeURIComponent(companyId)}/limits/`, { auth, schema: planUsageSchema }).then(
    (data) => data.metrics
  )
}

/** Заменяет изменения лимитов целиком: метрики, которых нет в limits, возвращаются к тарифу; -1 — без лимита */
export function setCompanyLimits(auth: ApiAuth, companyId: string, limits: Partial<Record<MetricUsage["metric"], number>>): Promise<MetricUsage[]> {
  return apiRequest(`${BASE}/companies/${encodeURIComponent(companyId)}/limits/`, {
    method: "PUT",
    auth,
    body: { limits },
    schema: planUsageSchema,
  }).then((data) => data.metrics)
}

export function listErrors(auth: ApiAuth, status: ErrorStatus | null, page: PageParams): Promise<Paginated<ErrorRecord>> {
  return apiRequest(`${BASE}/errors/`, { auth, query: { status, ...page }, schema: paginatedSchema(errorRecordSchema) })
}

export function setErrorStatus(auth: ApiAuth, errorId: string, status: ErrorStatus): Promise<ErrorRecord> {
  return apiRequest(`${BASE}/errors/${encodeURIComponent(errorId)}/`, {
    method: "PATCH",
    auth,
    body: { status },
    schema: errorRecordSchema,
  })
}

export function listTickets(auth: ApiAuth, status: TicketStatus | null, page: PageParams): Promise<Paginated<Ticket>> {
  return apiRequest(`${BASE}/tickets/`, { auth, query: { status, ...page }, schema: paginatedSchema(ticketSchema) })
}

export function getTicket(auth: ApiAuth, ticketId: string): Promise<Ticket> {
  return apiRequest(`${BASE}/tickets/${encodeURIComponent(ticketId)}/`, { auth, schema: ticketSchema })
}

export function updateTicket(
  auth: ApiAuth,
  ticketId: string,
  patch: { status?: TicketStatus; internalNote?: string }
): Promise<Ticket> {
  return apiRequest(`${BASE}/tickets/${encodeURIComponent(ticketId)}/`, {
    method: "PATCH",
    auth,
    body: patch,
    schema: ticketSchema,
  })
}
