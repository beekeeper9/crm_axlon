import { ApiError, apiErrorMessage } from "@/lib/api/errors"

/** Тексты правил найма — общие для формы и серверных действий */

/** Правило backend `department_has_head`: в отделе не больше одного действующего РОПа */
export const DEPARTMENT_HAS_HEAD_MESSAGE = "В этом отделе уже есть РОП. Создайте отдел для нового РОПа."

/** Правило `department_required`: у каждого сотрудника, кроме директора, есть отдел */
export const DEPARTMENT_REQUIRED_MESSAGE = "Выберите отдел, к которому будет прикреплён сотрудник"

/** Правило `no_department`: РОПа назначают только в существующий отдел */
export const NO_DEPARTMENT_MESSAGE = "Сначала создайте отдел продаж. После этого вы сможете назначить руководителя отдела"

/** Правило `has_history`: сотрудника с историей работы не удаляют, а увольняют (архивируют) */
export const HAS_HISTORY_MESSAGE =
  "У сотрудника есть история работы (лиды, клиенты, сделки, задачи и др.) — его нельзя удалить. Он остаётся в «Уволенных сотрудниках», история сохраняется."

/** Сообщения по кодам ошибок backend; код надёжнее английского текста */
export const STAFF_ERROR_CODES: Record<string, string> = {
  department_has_head: DEPARTMENT_HAS_HEAD_MESSAGE,
  department_required: DEPARTMENT_REQUIRED_MESSAGE,
  no_department: NO_DEPARTMENT_MESSAGE,
  has_history: HAS_HISTORY_MESSAGE,
}

/** Ответы backend на английском → понятные подписи полей */
export const STAFF_BACKEND_MESSAGES: Record<string, string> = {
  "This login is already taken.": "Такой логин уже занят — выберите другой",
  "This e-mail is already used by another account.": "Этот e-mail уже используется",
  "department_id is not an active department of this company.": "Выберите отдел своей компании",
  "You cannot give this role.": "Эту роль вы выдать не можете",
  "Hiring and dismissal are confirmed by the director.": "Нанимать и увольнять может только директор",
  "You are not assigned to a department.": "Вы не назначены в отдел — обратитесь к директору",
  "A department with this name already exists.": "Отдел с таким названием уже есть",
  "The request has already been decided.": "По заявке уже принято решение — обновите страницу",
  "You cannot deactivate your own account.": "Свой аккаунт отключить нельзя",
  "This account is already deactivated.": "Аккаунт уже отключён — обновите страницу",
  "Dismiss the employee first; only an archived account can be deleted.": "Сначала уволите сотрудника — удалить можно только аккаунт из «Уволенных сотрудников»",
  "You cannot delete your own account.": "Свой аккаунт удалить нельзя",
  "The owner must be an active member of this company.": "Передать можно только действующему сотруднику",
}

/** Сообщение для пользователя: по коду ошибки, затем по известному тексту, затем по виду ошибки */
export function staffErrorMessage(error: ApiError): string {
  if (error.kind === "contract_pending") return "В демо-режиме это действие не сохраняется на сервере."
  if (error.code && STAFF_ERROR_CODES[error.code]) return STAFF_ERROR_CODES[error.code]
  return STAFF_BACKEND_MESSAGES[error.message] ?? (error.kind === "validation" || error.kind === "conflict" ? error.message : apiErrorMessage(error))
}
