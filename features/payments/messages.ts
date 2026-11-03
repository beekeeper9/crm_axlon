import { ApiError, apiErrorMessage } from "@/lib/api/errors"

/** Ответы backend по оплатам → понятные сообщения (коды ошибок согласованы с backend) */
const CODE_MESSAGES: Record<string, string> = {
  receipt_required: "Прикрепите чек: без чека оплата не уходит на проверку.",
  receipt_invalid: "Чек не принят: нужен PDF или фото (JPEG, PNG, WEBP, HEIC) не больше 10 МБ.",
  payment_already_verified: "Эту оплату уже проверили — обновите страницу.",
}

export function paymentErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) throw error
  if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code]
  if (error.kind === "forbidden") {
    if (/yourself/i.test(error.message)) return "Свою оплату подтвердить нельзя — это делает руководитель."
    if (/department/i.test(error.message)) return "Можно проверять только оплаты своего отдела."
    return "Проверять оплаты может руководитель отдела продаж или директор."
  }
  if (error.kind === "not_found") return "Оплата или сделка недоступна: возможно, её передали другому сотруднику."
  if (error.kind === "validation" && /reason/i.test(error.message)) return "Укажите причину отклонения."
  return apiErrorMessage(error)
}
