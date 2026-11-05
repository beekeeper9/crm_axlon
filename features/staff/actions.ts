"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { routes } from "@/config/routes"
import { staffRepository } from "@/features/staff/api/staff-repository"
import { setPayTerms } from "@/features/staff/api/compensation"
import { assignMemberDepartment, assignRecord, deleteMember, fetchFormerBase, type RecordKind } from "@/features/staff/api/staff-profile"
import { DEPARTMENT_REQUIRED_MESSAGE, STAFF_BACKEND_MESSAGES, STAFF_ERROR_CODES, staffErrorMessage } from "@/features/staff/lib/staff-messages"
import { createStaffFormSchema, type ApprovedRequest } from "@/features/staff/schemas"
import { ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission, ROLE_LABELS, type Role } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

type FieldName = "fullName" | "login" | "departmentId" | "role"

export type CreateStaffState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Partial<Record<FieldName, string>>; requestId: string | null; values: Record<FieldName, string> }
  | {
      status: "created"
      /** Временный пароль — только в этом ответе: не логируется и не сохраняется в браузере */
      account: { fullName: string; login: string; temporaryPassword: string; roleLabel: string; department: string | null }
    }
  /** РОП: аккаунт появится после одобрения директором */
  | { status: "requested"; request: { fullName: string; roleLabel: string; department: string } }

const FIELDS: readonly FieldName[] = ["fullName", "login", "departmentId", "role"]

/**
 * Создание аккаунта: директор — в компании, РОП — менеджера своего отдела (напрямую, без заявки;
 * отдел backend подставляет сам). Если сервер для роли разрешает только заявку — отправляется заявка.
 * Право проверяется здесь и ещё раз на backend; интерфейс лишь не показывает форму тем, кому нельзя.
 */
export async function createStaffAccount(_previous: CreateStaffState, formData: FormData): Promise<CreateStaffState> {
  const user = await getCurrentUser()
  const values = Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? "")])) as Record<FieldName, string>
  if (!hasPermission(user.role, "staff.hire")) {
    return { status: "error", message: "У вашей роли нет права создавать аккаунты.", fieldErrors: {}, requestId: null, values }
  }

  const parsed = createStaffFormSchema.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldName, string>> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as FieldName] ??= issue.message
    return { status: "error", message: null, fieldErrors, requestId: null, values }
  }
  // Отдел обязателен всем, кроме директора; РОП создаёт в свой отдел — его подставит backend
  const fixedDepartment = (await staffRepository.getCreateOptions().catch(() => null))?.fixedDepartment ?? null
  if (!fixedDepartment && parsed.data.role !== "director" && !parsed.data.departmentId) {
    return { status: "error", message: null, fieldErrors: { departmentId: DEPARTMENT_REQUIRED_MESSAGE }, requestId: null, values }
  }
  const input = {
    fullName: parsed.data.fullName,
    login: parsed.data.login || null,
    departmentId: parsed.data.departmentId || null,
    role: (parsed.data.role || null) as Role | null,
  }

  try {
    const asRequest = (await staffRepository.getCreateOptions()).mode === "request"
    if (asRequest) {
      const request = await staffRepository.requestHire(input)
      revalidatePath(routes.staff)
      return {
        status: "requested",
        request: {
          fullName: request.candidate?.fullName ?? input.fullName,
          roleLabel: request.candidate ? ROLE_LABELS[request.candidate.role] : "",
          department: request.department.name,
        },
      }
    }
    const { member, temporaryPassword } = await staffRepository.createAccount(input)
    revalidatePath(routes.staff)
    revalidatePath(routes.company)
    return {
      status: "created",
      account: {
        fullName: member.fullName,
        login: member.login,
        temporaryPassword,
        roleLabel: ROLE_LABELS[member.role],
        department: member.department?.name ?? null,
      },
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    const fieldErrors: Partial<Record<FieldName, string>> = {}
    for (const field of FIELDS) {
      const message = error.fieldErrors?.[field]?.[0]
      if (message) fieldErrors[field] = STAFF_BACKEND_MESSAGES[message] ?? message
    }
    if (error.message === "This login is already taken.") fieldErrors.login = STAFF_BACKEND_MESSAGES[error.message]
    if (error.code === "department_required") fieldErrors.departmentId = STAFF_ERROR_CODES.department_required
    const message = Object.keys(fieldErrors).length > 0 ? null : staffErrorMessage(error)
    return { status: "error", message, fieldErrors, requestId: error.requestId ?? null, values }
  }
}

export type RequestActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string; requestId: string | null }

async function run<T>(operation: () => Promise<T>): Promise<RequestActionResult<T>> {
  try {
    const data = await operation()
    revalidatePath(routes.staff)
    revalidatePath(routes.company)
    return { ok: true, data }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: staffErrorMessage(error), requestId: error.requestId ?? null }
  }
}

/** Директор одобряет заявку; при найме пароль нового аккаунта приходит один раз */
export async function approveStaffRequest(requestId: string): Promise<RequestActionResult<ApprovedRequest>> {
  if (!hasPermission((await getCurrentUser()).role, "staff.hire")) return { ok: false, message: "Одобрять заявки может только директор.", requestId: null }
  return run(() => staffRepository.approveRequest(requestId))
}

export async function rejectStaffRequest(requestId: string, note: string): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "staff.hire")) return { ok: false, message: "Отклонять заявки может только директор.", requestId: null }
  return run(async () => {
    await staffRepository.rejectRequest(requestId, note.trim().slice(0, 500))
    return null
  })
}

export async function cancelStaffRequest(requestId: string): Promise<RequestActionResult> {
  return run(async () => {
    await staffRepository.cancelRequest(requestId)
    return null
  })
}

const departmentNameSchema = z.string().trim().min(2, "Не короче 2 символов").max(100, "Не длиннее 100 символов")

/** Новый отдел продаж — право директора, backend проверяет его ещё раз */
export async function createDepartmentAction(name: string): Promise<RequestActionResult<{ id: string; name: string }>> {
  if (!hasPermission((await getCurrentUser()).role, "company.view")) return { ok: false, message: "Создавать отделы может только директор.", requestId: null }
  const parsed = departmentNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Укажите название", requestId: null }
  return run(() => staffRepository.createDepartment(parsed.data))
}

/** Отключить сотрудника. Backend решает, можно ли (директор — компания, РОП — менеджеры отдела) */
export async function deactivateStaffAction(membershipId: string): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "staff.hire")) return { ok: false, message: "У вашей роли нет права отключать сотрудников.", requestId: null }
  return run(async () => {
    await staffRepository.deactivate(membershipId)
    return null
  })
}

/** Новый временный пароль сотруднику — показывается один раз и нигде не сохраняется */
export async function resetStaffPasswordAction(membershipId: string): Promise<RequestActionResult<string>> {
  if (!hasPermission((await getCurrentUser()).role, "staff.manage")) return { ok: false, message: "У вашей роли нет права сбрасывать пароли.", requestId: null }
  return run(() => staffRepository.resetPassword(membershipId))
}

/** Удалить аккаунт без истории работы — только директор; с историей backend откажет (has_history) */
export async function deleteStaffAction(membershipId: string): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "company.view")) return { ok: false, message: "Удалять аккаунты может только директор.", requestId: null }
  return run(async () => {
    await deleteMember(await getActionAuth(), membershipId)
    return null
  })
}

/** Прикрепить сотрудника без отдела к отделу — директор */
export async function assignDepartmentAction(membershipId: string, departmentId: string): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "company.view")) return { ok: false, message: "Назначать отдел может только директор.", requestId: null }
  if (!departmentId) return { ok: false, message: DEPARTMENT_REQUIRED_MESSAGE, requestId: null }
  return run(async () => {
    await assignMemberDepartment(await getActionAuth(), membershipId, departmentId)
    return null
  })
}

export type ReassignResult = { moved: number; failed: number; firstError: string | null }

/**
 * Передать записи уволенного сотрудника действующему: выбранные или все (`ids: "all"` — вся
 * текущая база этого вида). Каждая передача — отдельный запрос с аудитом на backend.
 */
export async function reassignRecordsAction(
  formerUserId: string,
  kind: RecordKind,
  ids: readonly string[] | "all",
  ownerUserId: string
): Promise<RequestActionResult<ReassignResult>> {
  if (!hasPermission((await getCurrentUser()).role, "staff.manage")) return { ok: false, message: "Перераспределять базу может директор или РОП.", requestId: null }
  if (!ownerUserId) return { ok: false, message: "Выберите сотрудника, которому передать записи.", requestId: null }
  const auth = await getActionAuth()
  let targets: readonly string[] = ids === "all" ? [] : ids
  if (ids === "all") {
    const base = await fetchFormerBase(auth, formerUserId)
    targets = (kind === "lead" ? base.leads : kind === "customer" ? base.customers : base.deals.filter((deal) => deal.status === "open")).map((row) => row.id)
  }
  let moved = 0
  let failed = 0
  let firstError: string | null = null
  for (const id of targets) {
    try {
      await assignRecord(auth, kind, id, ownerUserId)
      moved += 1
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      failed += 1
      firstError ??= staffErrorMessage(error)
    }
  }
  revalidatePath(routes.staff, "layout")
  return { ok: true, data: { moved, failed, firstError } }
}

const payTermsSchema = z.object({
  baseSalary: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, "").replace(",", "."))
    .refine((value) => /^\d{1,13}(\.\d{1,2})?$/.test(value), "Оклад — число, например 25000 (можно 0)"),
  commissionPercent: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .refine((value) => /^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100, "Процент — от 0 до 100, например 5 или 7.5"),
})

/** Оклад и процент с продаж сотрудника — только директор (backend проверяет ещё раз) */
export async function setPayTermsAction(
  membershipId: string,
  userId: string,
  input: z.input<typeof payTermsSchema>
): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "company.settings")) return { ok: false, message: "Оклад и процент задаёт директор.", requestId: null }
  const parsed = payTermsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля", requestId: null }
  const result = await run(async () => setPayTerms(await getActionAuth(), userId, parsed.data))
  if (!result.ok) return result
  revalidatePath(`${routes.staff}/${encodeURIComponent(membershipId)}`)
  return { ok: true, data: null }
}
