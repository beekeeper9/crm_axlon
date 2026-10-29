/**
 * ТЕСТОВЫЕ учётные записи демо-режима. Вымышленные люди, пароли — только для демо.
 * Работают исключительно при NEXT_PUBLIC_DATA_SOURCE=mock и не имеют отношения к реальному backend.
 */
import type { Role } from "@/lib/permissions/roles"

export type DemoAccountSeed = {
  id: string
  login: string
  password: string
  fullName: string
  role: Role
  companyId: string | null
  departmentId: string | null
  status?: "active" | "deactivated"
}

export const DEMO_COMPANIES = [
  { id: "c-demo", name: "Демо Компания" },
  { id: "c-sample", name: "ОсОО «Пример»" },
] as const

export const DEMO_DEPARTMENTS = [
  { id: "d-1", companyId: "c-demo", name: "Отдел продаж" },
  { id: "d-2", companyId: "c-demo", name: "Отдел продаж — Ош" },
  { id: "d-3", companyId: "c-sample", name: "Продажи" },
] as const

const MANAGER_PASSWORD = "Demo-sales-2026"

export const DEMO_ACCOUNT_SEED: readonly DemoAccountSeed[] = [
  { id: "u-admin", login: "platform", password: "Demo-platform-2026", fullName: "Админ Платформы", role: "platform_admin", companyId: null, departmentId: null },
  { id: "u-director", login: "director", password: "Demo-director-2026", fullName: "Эрмек Жумабаев", role: "director", companyId: "c-demo", departmentId: null },
  { id: "u-rop", login: "rop", password: "Demo-rop-2026", fullName: "Алина Ким", role: "head_of_sales", companyId: "c-demo", departmentId: "d-1" },
  { id: "u-rop-osh", login: "rop.osh", password: "Demo-rop-2026", fullName: "Эльмира Ташиева", role: "head_of_sales", companyId: "c-demo", departmentId: "d-2" },
  { id: "m-1", login: "aibek", password: MANAGER_PASSWORD, fullName: "Айбек Садыков", role: "manager", companyId: "c-demo", departmentId: "d-1" },
  { id: "m-2", login: "nurlan", password: MANAGER_PASSWORD, fullName: "Нурлан Абдыкадыров", role: "manager", companyId: "c-demo", departmentId: "d-1" },
  { id: "m-3", login: "maria", password: MANAGER_PASSWORD, fullName: "Мария Орлова", role: "manager", companyId: "c-demo", departmentId: "d-1" },
  { id: "m-4", login: "bakyt", password: MANAGER_PASSWORD, fullName: "Бакыт Токтогулов", role: "manager", companyId: "c-demo", departmentId: "d-1" },
  { id: "m-5", login: "dinara", password: MANAGER_PASSWORD, fullName: "Динара Асанова", role: "manager", companyId: "c-demo", departmentId: "d-1" },
  { id: "m-6", login: "timur", password: MANAGER_PASSWORD, fullName: "Тимур Ли", role: "manager", companyId: "c-demo", departmentId: "d-1" },
  { id: "m-7", login: "aziz", password: MANAGER_PASSWORD, fullName: "Азиз Мамытов", role: "manager", companyId: "c-demo", departmentId: "d-2" },
  { id: "u-viewer", login: "viewer", password: "Demo-viewer-2026", fullName: "Света Пак", role: "viewer", companyId: "c-demo", departmentId: null },
  { id: "u-former", login: "former", password: MANAGER_PASSWORD, fullName: "Бывший Сотрудник", role: "manager", companyId: "c-demo", departmentId: "d-1", status: "deactivated" },
  { id: "u-director-2", login: "director.sample", password: "Demo-director-2026", fullName: "Гульнара Осмонова", role: "director", companyId: "c-sample", departmentId: null },
]

/** Подсказка на странице входа в демо-режиме: какие тестовые входы есть */
export const DEMO_LOGIN_HINTS: readonly { label: string; login: string; password: string }[] = [
  { label: "Менеджер", login: "aibek", password: MANAGER_PASSWORD },
  { label: "РОП", login: "rop", password: "Demo-rop-2026" },
  { label: "Директор", login: "director", password: "Demo-director-2026" },
  { label: "Администратор платформы", login: "platform", password: "Demo-platform-2026" },
]
