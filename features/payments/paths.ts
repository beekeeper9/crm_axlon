/**
 * Адреса раздела оплат. Пункт меню добавляется в config/navigation.ts и config/routes.ts
 * отдельно (эти файлы ведёт владелец навигации), поэтому пути объявлены здесь.
 */
export const PAYMENT_REVIEW_PATH = "/payments/review"
/** BFF: отправка оплаты с чеком (multipart) и выдача чека */
export const PAYMENT_UPLOAD_PATH = "/payment-receipts"
