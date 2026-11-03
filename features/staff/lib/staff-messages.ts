import { ApiError, apiErrorMessage } from "@/lib/api/errors"

/** Тексты правил найма — общие для формы и серверных действий */

/** Правило backend `department_has_head`: в отделе не больше одного действующего РОПа */
export const DEPARTMENT_HAS_HEAD_MESSAGE = "В этом отделе уже есть РОП. Создайте отдел для нового РОПа."

/** Сообщения по кодам ошибок backend; код надёжнее английского текста */
export const STAFF_ERROR_CODES: Record<string, string> = {
  department_has_head: DEPARTMENT_HAS_HEAD_MESSAGE,
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
}

/** Сообщение для пользователя: по коду ошибки, затем по известному тексту, затем по виду ошибки */
export function staffErrorMessage(error: ApiError): string {
  if (error.kind === "contract_pending") return "В демо-режиме это действие не сохраняется на сервере."
  if (error.code && STAFF_ERROR_CODES[error.code]) return STAFF_ERROR_CODES[error.code]
  return STAFF_BACKEND_MESSAGES[error.message] ?? (error.kind === "validation" || error.kind === "conflict" ? error.message : apiErrorMessage(error))
}
