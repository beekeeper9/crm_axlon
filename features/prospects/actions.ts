"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import {
  addProspectNote,
  assignLead,
  convertLead,
  createLead,
  disqualifyLead,
  qualifyLead,
  updateLead,
  type ConversionResult,
} from "@/features/prospects/api/prospects-repository"
import { prospectSourceSchema } from "@/features/prospects/schemas"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type ProspectActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string; requestId: string | null }

const DEMO_ONLY = { ok: false as const, message: "В демо-режиме входящие лиды на сервер не сохраняются.", requestId: null }

/** Ответы backend на английском → понятные сообщения */
const BACKEND_MESSAGES: Record<string, string> = {
  "Lead not found.": "Лид недоступен: возможно, его передали другому сотруднику.",
  "Lead was modified by someone else; reload and retry.": "Лид уже изменил другой сотрудник. Обновите страницу и повторите.",
  "Lead name must not be empty.": "Укажите имя.",
  "A lead needs at least an e-mail or a phone number.": "Нужен телефон или e-mail.",
  "A converted lead can no longer be edited.": "Лид уже стал клиентом — меняйте данные в карточке клиента.",
  "A converted lead cannot be disqualified.": "Лид уже стал клиентом — отклонить его нельзя.",
  "A disqualification reason is required.": "Укажите причину.",
  "A converted lead is handled through its customer.": "Лид уже стал клиентом — работайте с ним в карточке клиента.",
  "Only a qualified lead can be converted.": "Сначала квалифицируйте лид — конвертировать можно только квалифицированный.",
}

function failure(error: unknown): ProspectActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  const message =
    BACKEND_MESSAGES[error.message] ??
    (error.kind === "conflict" ? "Лид уже изменил другой сотрудник. Обновите страницу и повторите." : apiErrorMessage(error))
  return { ok: false, message, requestId: error.requestId ?? null }
}

async function run<T>(operation: () => Promise<T>): Promise<ProspectActionResult<T>> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    const data = await operation()
    revalidatePath(routes.prospects, "layout")
    return { ok: true, data }
  } catch (error) {
    return failure(error)
  }
}

const normalizePhone = (value: string) => value.replace(/[\s()-]/g, "")

const contactsSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя или название").max(200, "Не длиннее 200 символов"),
    phone: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\+[1-9]\d{6,14}$/.test(normalizePhone(value)), "Телефон в формате +996555123456"),
    email: z.union([z.email("Неверный e-mail"), z.literal("")]),
  })
  .refine((value) => value.phone !== "" || value.email !== "", { message: "Нужен телефон или e-mail", path: ["phone"] })

type ContactsInput = z.input<typeof contactsSchema>

type Contacts = { name: string; phone: string | null; email: string | null }

function parseContacts(input: ContactsInput): { error: string } | { data: Contacts } {
  const parsed = contactsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" }
  return {
    data: { name: parsed.data.name, phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : null, email: parsed.data.email || null },
  }
}

const invalid = (message: string): ProspectActionResult<never> => ({ ok: false, message, requestId: null })

export async function createProspectAction(input: ContactsInput & { source: string; ownerId?: string | null }): Promise<ProspectActionResult<string>> {
  const contacts = parseContacts(input)
  if ("error" in contacts) return invalid(contacts.error)
  const source = prospectSourceSchema.safeParse(input.source)
  if (!source.success) return invalid("Выберите источник")
  return run(async () => createLead(await getActionAuth(), { ...contacts.data, source: source.data, ownerId: input.ownerId ?? null }))
}

/** Примечание к лиду: видно в карточке лида всем, кто его видит */
export async function addProspectNoteAction(prospectId: string, body: string): Promise<ProspectActionResult> {
  const trimmed = body.trim()
  if (trimmed.length < 2) return invalid("Напишите примечание")
  if (trimmed.length > 4000) return invalid("Не длиннее 4000 символов")
  return run(async () => {
    await addProspectNote(await getActionAuth(), prospectId, trimmed)
    return null
  })
}

export async function updateProspectAction(prospectId: string, input: ContactsInput, version: number): Promise<ProspectActionResult> {
  const contacts = parseContacts(input)
  if ("error" in contacts) return invalid(contacts.error)
  return run(async () => {
    await updateLead(await getActionAuth(), prospectId, { ...contacts.data, version })
    return null
  })
}

export async function assignProspectAction(prospectId: string, ownerUserId: string): Promise<ProspectActionResult> {
  return run(async () => {
    await assignLead(await getActionAuth(), prospectId, ownerUserId)
    return null
  })
}

export async function qualifyProspectAction(prospectId: string): Promise<ProspectActionResult> {
  return run(async () => {
    await qualifyLead(await getActionAuth(), prospectId)
    return null
  })
}

export async function disqualifyProspectAction(prospectId: string, reason: string): Promise<ProspectActionResult> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) return invalid("Укажите причину — хотя бы 3 символа")
  return run(async () => {
    await disqualifyLead(await getActionAuth(), prospectId, trimmed.slice(0, 500))
    return null
  })
}

/**
 * Сделка при конвертации — всегда со следующим шагом (решение владельца 05.11.2026): без шага
 * сделка попала бы на «Продажи» с пометкой «Нет следующего шага».
 */
const dealSchema = z.object({
  title: z.string().trim().min(2, "Название сделки — хотя бы 2 символа").max(200, "Не длиннее 200 символов"),
  amount: z.string().trim().regex(/^\d{1,13}([.,]\d{1,2})?$/, "Сумма — число, например 15000"),
  pipelineId: z.string().nullable(),
  stageId: z.string().nullable(),
  productId: z.string().nullable().default(null),
  nextStepTitle: z.string().trim().min(3, "Следующий шаг — что сделать, хотя бы 3 символа").max(200, "Шаг — не длиннее 200 символов"),
  nextStepDue: z.iso.date("Укажите срок следующего шага"),
})

export async function convertProspectAction(
  prospectId: string,
  input: { customerId: string | null; deal: z.input<typeof dealSchema>; qualifyFirst?: boolean }
): Promise<ProspectActionResult<ConversionResult>> {
  const parsed = dealSchema.safeParse(input.deal)
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Проверьте сделку")
  const deal = {
    title: parsed.data.title,
    amount: parsed.data.amount.replace(",", "."),
    pipelineId: parsed.data.pipelineId,
    stageId: parsed.data.stageId,
    productId: parsed.data.productId,
    nextStep: { title: parsed.data.nextStepTitle, dueDate: parsed.data.nextStepDue },
  }
  return run(async () => {
    const auth = await getActionAuth()
    // С доски лид можно перетащить в «Стал клиентом» прямо из «Нового»: backend конвертирует
    // только квалифицированный, поэтому сначала квалификация
    if (input.qualifyFirst) await qualifyLead(auth, prospectId)
    const result = await convertLead(auth, prospectId, { customerId: input.customerId, deal })
    revalidatePath(routes.clientBase)
    if (result.dealId) revalidatePath(routes.sales)
    return result
  })
}
