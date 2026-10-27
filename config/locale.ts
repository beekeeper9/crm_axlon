/**
 * Региональные настройки по умолчанию: Кыргызстан, русский интерфейс.
 * В будущем значения придут из настроек компании.
 */
export const localeConfig = {
  locale: "ru-RU",
  currency: "KGS",
  /** Подпись валюты: Intl для ru-RU показывает код "KGS", а пользователи привыкли к «сом». */
  currencyLabel: "сом",
  timeZone: "Asia/Bishkek",
} as const
