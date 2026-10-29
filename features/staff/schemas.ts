import { z } from "zod"

import { ROLES } from "@/lib/permissions/roles"

/**
 * Сотрудники и создание аккаунтов. ПРЕДЛОЖЕНИЕ, НЕ согласовано с backend (API_CONTRACT.md → «Сотрудники»).
 * Роль нового аккаунта не передаётся: её назначает сервер по роли создателя.
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const accountStatusSchema = z.enum(["active", "invited", "deactivated"])

export const staffMemberSchema = z.object({
  id: z.string(),
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
  creatableRole: z.enum(ROLES).nullable(),
  /** Администратор платформы создаёт директора вместе с новой компанией */
  requiresCompanyName: z.boolean(),
  /** Директор выбирает отдел своей компании */
  departments: z.array(refSchema),
  /** РОП создаёт сотрудников только в своём отделе */
  fixedDepartment: refSchema.nullable(),
  /** Можно ли задать логин вручную (иначе сервер сгенерирует) */
  loginIsOptional: z.boolean(),
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
  companyName: z.string().trim().max(120, "Не длиннее 120 символов"),
})

export type AccountStatus = z.infer<typeof accountStatusSchema>
export type StaffMember = z.infer<typeof staffMemberSchema>
export type CreateOptions = z.infer<typeof createOptionsSchema>
export type CreatedAccount = z.infer<typeof createdAccountSchema>
export type CreateStaffInput = { fullName: string; login: string | null; departmentId: string | null; companyName: string | null }
