import { z } from "zod"

import { ROLES, type Role } from "@/lib/permissions/roles"

/**
 * Сотрудники, создание аккаунтов и заявки на найм. Контракт backend: `/api/v1/staff/…`
 * (API_CONTRACT.md → «Сотрудники»). Какие роли можно выдать — решает сервер по роли создателя.
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const accountStatusSchema = z.enum(["active", "invited", "deactivated"])

export const staffMemberSchema = z.object({
  /** Членство в компании (действия «Пароль», «Отключить» адресуются по нему) */
  id: z.string(),
  /** Пользователь: по нему связаны смены, планы и записи CRM */
  userId: z.string(),
  login: z.string(),
  fullName: z.string(),
  role: z.enum(ROLES),
  company: refSchema.nullable(),
  department: refSchema.nullable(),
  status: accountStatusSchema,
  createdBy: refSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})

/** Что может создать текущий пользователь — отдаёт сервер, интерфейс только подписывает форму */
export const createOptionsSchema = z.object({
  /** Роль по умолчанию (первая из разрешённых) */
  creatableRole: z.enum(ROLES).nullable(),
  /** Все роли, которые можно выдать; больше одной — в форме появляется выбор */
  roles: z.array(z.enum(ROLES)),
  /** direct — аккаунт создаётся сразу (директор); request — заявка директору (РОП) */
  mode: z.enum(["direct", "request"]),
  /** Директор выбирает отдел своей компании */
  departments: z.array(refSchema),
  /** РОП создаёт сотрудников только в своём отделе */
  fixedDepartment: refSchema.nullable(),
  /** Можно ли задать логин вручную (иначе сервер сгенерирует) */
  loginIsOptional: z.boolean(),
  /** Отделы, где уже есть действующий РОП: второго туда назначить нельзя */
  departmentsWithHead: z.array(z.string()).default([]),
})

/** Ответ на создание: временный пароль приходит один раз и больше нигде не хранится */
export const createdAccountSchema = z.object({
  member: staffMemberSchema,
  temporaryPassword: z.string(),
})

export const createStaffFormSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите имя и фамилию").max(120, "Не длиннее 120 символов"),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === "" || /^[a-z0-9._-]{3,32}$/.test(value), "3–32 символа: латинские буквы, цифры, точка, дефис, подчёркивание"),
  departmentId: z.string(),
  role: z.union([z.enum(ROLES), z.literal("")]),
})

/** Заявка РОПа на найм или увольнение; решение — за директором */
export const staffRequestSchema = z.object({
  id: z.string(),
  kind: z.enum(["hire", "dismiss"]),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  department: refSchema,
  requestedBy: refSchema,
  createdAt: z.iso.datetime({ offset: true }),
  candidate: z.object({ fullName: z.string(), login: z.string().nullable(), role: z.enum(ROLES) }).nullable(),
  target: refSchema.nullable(),
  reason: z.string(),
  decidedBy: z.string().nullable(),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  decisionNote: z.string(),
})

/** Одобренная заявка на найм: временный пароль приходит один раз */
export const approvedRequestSchema = z.object({
  request: staffRequestSchema,
  login: z.string().nullable(),
  temporaryPassword: z.string().nullable(),
})

export type AccountStatus = z.infer<typeof accountStatusSchema>
export type StaffMember = z.infer<typeof staffMemberSchema>
export type CreateOptions = z.infer<typeof createOptionsSchema>
export type CreatedAccount = z.infer<typeof createdAccountSchema>
export type StaffRequest = z.infer<typeof staffRequestSchema>
export type ApprovedRequest = z.infer<typeof approvedRequestSchema>
export type CreateStaffInput = { fullName: string; login: string | null; departmentId: string | null; role: Role | null }
