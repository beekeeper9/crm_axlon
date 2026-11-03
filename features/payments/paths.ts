import { routes } from "@/config/routes"

/** Адреса раздела оплат; очередь проверки — пункт меню «Проверка оплат» */
export const PAYMENT_REVIEW_PATH = routes.paymentReview
/** BFF: отправка оплаты с чеком (multipart) и выдача чека */
export const PAYMENT_UPLOAD_PATH = "/payment-receipts"
