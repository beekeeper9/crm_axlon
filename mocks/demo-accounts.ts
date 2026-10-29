/**
 * ДЕМО-«backend» учётных записей: компании, отделы, аккаунты, сессии.
 * Хранится в памяти сервера Next.js и сбрасывается при перезапуске. Только для режима mock:
 * показывает сценарий (вход, создание аккаунтов, временный пароль, смена пароля), но не является
 * доказательством безопасности — в реальном режиме всё это делает Python backend.
 */
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto"

import { CREATABLE_ROLE, type Role } from "@/lib/permissions/roles"
import { DEMO_ACCOUNT_SEED, DEMO_COMPANIES, DEMO_DEPARTMENTS } from "@/mocks/demo-accounts.seed"

export type DemoAccountStatus = "active" | "invited" | "deactivated"

export type DemoAccount = {
  id: string
  login: string
  fullName: string
  role: Role
  companyId: string | null
  departmentId: string | null
  createdById: string | null
  createdAt: string
  status: DemoAccountStatus
  mustChangePassword: boolean
  passwordHash: string
  salt: string
}

type DemoStore = {
  accounts: Map<string, DemoAccount>
  companies: Map<string, { id: string; name: string }>
  departments: Map<string, { id: string; companyId: string; name: string }>
  sessions: Map<string, string>
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex")
}

function seedStore(): DemoStore {
  const accounts = new Map<string, DemoAccount>()
  for (const seed of DEMO_ACCOUNT_SEED) {
    const salt = randomBytes(8).toString("hex")
    accounts.set(seed.id, {
      id: seed.id,
      login: seed.login,
      fullName: seed.fullName,
      role: seed.role,
      companyId: seed.companyId,
      departmentId: seed.departmentId,
      createdById: null,
      createdAt: "2026-09-01T09:00:00+06:00",
      status: seed.status ?? "active",
      mustChangePassword: false,
      passwordHash: hashPassword(seed.password, salt),
      salt,
    })
  }
  return {
    accounts,
    companies: new Map(DEMO_COMPANIES.map((company) => [company.id, { ...company }])),
    departments: new Map(DEMO_DEPARTMENTS.map((department) => [department.id, { ...department }])),
    sessions: new Map(),
  }
}

// Переживает горячую перезагрузку модулей в dev, но не перезапуск сервера
const globalStore = globalThis as typeof globalThis & { __crmDemoStore?: DemoStore }
const store = (globalStore.__crmDemoStore ??= seedStore())

export function demoCompany(id: string | null) {
  return id ? (store.companies.get(id) ?? null) : null
}

export function demoDepartment(id: string | null) {
  return id ? (store.departments.get(id) ?? null) : null
}

export function demoDepartmentsOf(companyId: string) {
  return [...store.departments.values()].filter((department) => department.companyId === companyId)
}

export function demoAccount(id: string): DemoAccount | null {
  return store.accounts.get(id) ?? null
}

export function demoAccounts(): DemoAccount[] {
  return [...store.accounts.values()]
}

/** Одинаковый ответ на неверный логин и неверный пароль — не раскрываем, существует ли аккаунт */
export function demoVerifyCredentials(login: string, password: string): { ok: true; account: DemoAccount } | { ok: false; reason: "invalid" | "deactivated" } {
  const account = [...store.accounts.values()].find((item) => item.login === login.trim().toLowerCase())
  const expected = account ? Buffer.from(account.passwordHash, "hex") : randomBytes(32)
  const actual = Buffer.from(hashPassword(password, account?.salt ?? "no-account"), "hex")
  if (!account || !timingSafeEqual(expected, actual)) return { ok: false, reason: "invalid" }
  // О деактивации говорим только тому, кто знает верный пароль
  if (account.status === "deactivated") return { ok: false, reason: "deactivated" }
  return { ok: true, account }
}

export function demoCreateSession(accountId: string): string {
  const token = randomBytes(24).toString("base64url")
  store.sessions.set(token, accountId)
  return token
}

export function demoSessionAccount(token: string | undefined): DemoAccount | null {
  if (!token) return null
  const id = store.sessions.get(token)
  const account = id ? store.accounts.get(id) : undefined
  return account && account.status !== "deactivated" ? account : null
}

export function demoDestroySession(token: string | undefined): void {
  if (token) store.sessions.delete(token)
}

export function demoChangePassword(accountId: string, current: string, next: string): { ok: true } | { ok: false; field: "currentPassword" | "newPassword"; message: string } {
  const account = store.accounts.get(accountId)
  if (!account || hashPassword(current, account.salt) !== account.passwordHash) {
    return { ok: false, field: "currentPassword", message: "Текущий пароль указан неверно" }
  }
  if (next === current) return { ok: false, field: "newPassword", message: "Новый пароль должен отличаться от временного" }
  const salt = randomBytes(8).toString("hex")
  store.accounts.set(accountId, { ...account, salt, passwordHash: hashPassword(next, salt), mustChangePassword: false, status: "active" })
  return { ok: true }
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/** Временный пароль: 12 символов без похожих (0/O, 1/l), группами для удобной передачи */
function generateTemporaryPassword(): string {
  const chars = Array.from({ length: 12 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)])
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`
}

function generateLogin(): string {
  let login: string
  do login = `user_${randomInt(1000, 9999)}`
  while ([...store.accounts.values()].some((account) => account.login === login))
  return login
}

export type DemoCreateInput = {
  fullName: string
  login: string | null
  departmentId: string | null
  companyName: string | null
}

export type DemoCreateResult =
  | { ok: true; account: DemoAccount; temporaryPassword: string }
  | { ok: false; status: 403 | 400; field?: "login" | "departmentId" | "companyName"; message: string }

/**
 * Создание аккаунта по иерархии. Роль нового аккаунта, компанию и отдел определяет «сервер»:
 * администратор → директор новой компании, директор → РОП своей компании, РОП → менеджер своего отдела.
 */
export function demoCreateAccount(creatorId: string, input: DemoCreateInput): DemoCreateResult {
  const creator = store.accounts.get(creatorId)
  const role = creator ? CREATABLE_ROLE[creator.role] : undefined
  if (!creator || !role) return { ok: false, status: 403, message: "Нет прав создавать аккаунты" }

  const login = input.login?.trim().toLowerCase() || generateLogin()
  if ([...store.accounts.values()].some((account) => account.login === login)) {
    return { ok: false, status: 400, field: "login", message: "Такой логин уже занят — выберите другой" }
  }

  let companyId = creator.companyId
  let departmentId: string | null = null
  if (creator.role === "platform_admin") {
    if (!input.companyName?.trim()) return { ok: false, status: 400, field: "companyName", message: "Укажите название компании" }
    companyId = `c-${randomBytes(4).toString("hex")}`
    store.companies.set(companyId, { id: companyId, name: input.companyName.trim() })
  } else if (creator.role === "director") {
    const department = input.departmentId ? store.departments.get(input.departmentId) : undefined
    if (!department || department.companyId !== creator.companyId) {
      return { ok: false, status: 400, field: "departmentId", message: "Выберите отдел своей компании" }
    }
    departmentId = department.id
  } else {
    // РОП создаёт менеджеров только в своём отделе — переданный отдел игнорируется
    departmentId = creator.departmentId
  }

  const temporaryPassword = generateTemporaryPassword()
  const salt = randomBytes(8).toString("hex")
  const account: DemoAccount = {
    id: `u-${randomBytes(4).toString("hex")}`,
    login,
    fullName: input.fullName.trim(),
    role,
    companyId,
    departmentId,
    createdById: creator.id,
    createdAt: new Date().toISOString(),
    status: "invited",
    mustChangePassword: true,
    passwordHash: hashPassword(temporaryPassword, salt),
    salt,
  }
  store.accounts.set(account.id, account)
  return { ok: true, account, temporaryPassword }
}

/** Кого видит пользователь в списке сотрудников: админ — директоров, директор — компанию, РОП — свой отдел */
export function demoVisibleAccounts(viewerId: string): DemoAccount[] {
  const viewer = store.accounts.get(viewerId)
  if (!viewer) return []
  const all = [...store.accounts.values()].filter((account) => account.id !== viewer.id)
  switch (viewer.role) {
    case "platform_admin":
      return all.filter((account) => account.role === "director")
    case "director":
      return all.filter((account) => account.companyId === viewer.companyId && account.role !== "director")
    case "head_of_sales":
      return all.filter((account) => account.departmentId === viewer.departmentId && account.role === "manager")
    default:
      return []
  }
}
