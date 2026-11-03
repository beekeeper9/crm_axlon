"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import {
  addCustomerNote,
  assignCustomer,
  createCustomer,
  createCustomerDeal,
  customerMerge,
  searchCustomers,
  setCustomerArchived,
  updateCustomer,
  type ClientOption,
  type MergePlan,
} from "@/features/clients/api/clients-repository"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type ClientActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string; requestId: string | null }

const DEMO_ONLY = { ok: false as const, message: "В демо-режиме клиенты на сервер не сохраняются.", requestId: null }

/** Ответы backend на английском → понятные сообщения */
const BACKEND_MESSAGES: Record<string, string> = {
  "A customer with this e-mail already exists.": "Клиент с таким e-mail уже есть — найдите его поиском.",
  "The customer is archived; restore it first.": "Клиент в архиве — сначала восстановите его.",
  "You can only assign customers to yourself.": "Менеджер не может передавать клиентов.",
  "You can only assign customers to members of your department.": "Передать можно только сотруднику своего отдела.",
  "The assignee is not an active member of this company.": "Этот сотрудник не работает в компании.",
  "Choose two different customers to merge.": "Выберите другую карточку: клиента нельзя объединить с самим собой.",
  "Merging customers is for the director or a head of sales.": "Объединять карточки может директор или руководитель отдела продаж.",
  "This customer has already been merged into another one.": "Эта карточка уже объединена с другой.",
  "Merge into an active customer: restore the kept card first.": "Основная карточка в архиве — сначала верните её из архива.",
  "This card was merged into another customer and cannot be restored.":
    "Карточка объединена с другой и не восстанавливается — откройте основную карточку.",
}

function failure(error: unknown): ClientActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  const message =
    BACKEND_MESSAGES[error.message] ??
    (error.kind === "not_found" ? "Клиент недоступен: возможно, его передали другому сотруднику." : apiErrorMessage(error))
  return { ok: false, message, requestId: error.requestId ?? null }
}

async function run<T>(operation: () => Promise<T>): Promise<ClientActionResult<T>> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    const data = await operation()
    revalidatePath(routes.clientBase)
    return { ok: true, data }
  } catch (error) {
    return failure(error)
  }
}

const newClientSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя или название").max(200, "Не длиннее 200 символов"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\+[1-9]\d{6,14}$/.test(value.replace(/[\s()-]/g, "")), "Телефон в формате +996555123456"),
  email: z.union([z.email("Неверный e-mail"), z.literal("")]),
})

export type ClientContactsInput = z.input<typeof newClientSchema>

export async function createClientAction(input: z.input<typeof newClientSchema>): Promise<ClientActionResult<string>> {
  const parsed = newClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля", requestId: null }
  return run(async () =>
    createCustomer(await getActionAuth(), {
      name: parsed.data.name,
      phone: parsed.data.phone ? parsed.data.phone.replace(/[\s()-]/g, "") : null,
      email: parsed.data.email || null,
    })
  )
}

export async function setClientArchivedAction(clientId: string, archived: boolean): Promise<ClientActionResult> {
  return run(async () => {
    await setCustomerArchived(await getActionAuth(), clientId, archived)
    return null
  })
}

export async function assignClientAction(clientId: string, ownerUserId: string): Promise<ClientActionResult> {
  return run(async () => {
    await assignCustomer(await getActionAuth(), clientId, ownerUserId)
    return null
  })
}

const newDealSchema = z.object({
  title: z.string().trim().min(2, "Укажите название сделки").max(200, "Не длиннее 200 символов"),
  amount: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/, "Сумма — число, например 15000 или 15000.50"),
})

/** Новая сделка клиента; после успеха интерфейс открывает её карточку */
export async function createClientDealAction(clientId: string, input: z.input<typeof newDealSchema>): Promise<ClientActionResult<string>> {
  const parsed = newDealSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля", requestId: null }
  const result = await run(async () =>
    createCustomerDeal(await getActionAuth(), { customerId: clientId, title: parsed.data.title, amount: parsed.data.amount, pipelineId: null })
  )
  if (result.ok) revalidatePath(routes.sales)
  return result
}

/** Изменить имя и контакты; пустой телефон или e-mail очищает поле */
export async function updateClientAction(clientId: string, input: ClientContactsInput): Promise<ClientActionResult> {
  const parsed = newClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля", requestId: null }
  return run(async () => {
    await updateCustomer(await getActionAuth(), clientId, {
      name: parsed.data.name,
      phone: parsed.data.phone.replace(/[\s()-]/g, ""),
      email: parsed.data.email,
    })
    return null
  })
}

const noteSchema = z.string().trim().min(1, "Напишите заметку").max(5000, "Не длиннее 5000 символов")

export async function addClientNoteAction(clientId: string, body: string): Promise<ClientActionResult> {
  const parsed = noteSchema.safeParse(body)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте заметку", requestId: null }
  return run(async () => {
    await addCustomerNote(await getActionAuth(), clientId, parsed.data)
    return null
  })
}

/** Поиск карточек для выбора дубля или привязки звонка; меньше 2 символов — пустой список */
export async function searchClientsAction(search: string): Promise<ClientActionResult<ClientOption[]>> {
  const needle = search.trim()
  if (needle.length < 2) return { ok: true, data: [] }
  if (isMockDataSource) return DEMO_ONLY
  try {
    return { ok: true, data: await searchCustomers(await getActionAuth(), needle) }
  } catch (error) {
    return failure(error)
  }
}

/** Что перейдёт к основной карточке из дубля; ничего не меняет */
export async function previewClientMergeAction(targetId: string, sourceId: string): Promise<ClientActionResult<MergePlan>> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    return { ok: true, data: await customerMerge(await getActionAuth(), targetId, sourceId, false) }
  } catch (error) {
    return failure(error)
  }
}

/** Объединить дубль с основной карточкой: сделки, задачи, встречи, звонки и оплаты переходят к ней */
export async function mergeClientsAction(targetId: string, sourceId: string): Promise<ClientActionResult<MergePlan>> {
  const result = await run(async () => customerMerge(await getActionAuth(), targetId, sourceId, true))
  if (result.ok) revalidatePath(routes.sales)
  return result
}
