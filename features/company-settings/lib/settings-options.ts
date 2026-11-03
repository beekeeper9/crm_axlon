/**
 * Варианты для формы настроек: страны и валюты рынков, с которыми работает продукт, и их часовые пояса.
 * Backend принимает любой код ISO и любой пояс IANA; текущее значение компании всегда добавляется
 * в список, даже если его здесь нет, — форма не должна молча подменять настройку.
 */

export type SettingOption = { value: string; label: string }

export const COUNTRY_OPTIONS: readonly SettingOption[] = [
  { value: "KG", label: "Кыргызстан" },
  { value: "KZ", label: "Казахстан" },
  { value: "UZ", label: "Узбекистан" },
  { value: "TJ", label: "Таджикистан" },
  { value: "RU", label: "Россия" },
  { value: "BY", label: "Беларусь" },
  { value: "AM", label: "Армения" },
  { value: "GE", label: "Грузия" },
  { value: "AZ", label: "Азербайджан" },
  { value: "TR", label: "Турция" },
  { value: "AE", label: "ОАЭ" },
]

export const CURRENCY_OPTIONS: readonly SettingOption[] = [
  { value: "KGS", label: "KGS — сом" },
  { value: "KZT", label: "KZT — тенге" },
  { value: "UZS", label: "UZS — сум" },
  { value: "TJS", label: "TJS — сомони" },
  { value: "RUB", label: "RUB — рубль" },
  { value: "BYN", label: "BYN — белорусский рубль" },
  { value: "AMD", label: "AMD — драм" },
  { value: "GEL", label: "GEL — лари" },
  { value: "AZN", label: "AZN — манат" },
  { value: "TRY", label: "TRY — лира" },
  { value: "AED", label: "AED — дирхам" },
  { value: "USD", label: "USD — доллар США" },
  { value: "EUR", label: "EUR — евро" },
]

export const TIMEZONE_OPTIONS: readonly SettingOption[] = [
  { value: "Asia/Bishkek", label: "Бишкек (UTC+6)" },
  { value: "Asia/Almaty", label: "Алматы (UTC+5)" },
  { value: "Asia/Tashkent", label: "Ташкент (UTC+5)" },
  { value: "Asia/Dushanbe", label: "Душанбе (UTC+5)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Europe/Minsk", label: "Минск (UTC+3)" },
  { value: "Asia/Yerevan", label: "Ереван (UTC+4)" },
  { value: "Asia/Tbilisi", label: "Тбилиси (UTC+4)" },
  { value: "Asia/Baku", label: "Баку (UTC+4)" },
  { value: "Europe/Istanbul", label: "Стамбул (UTC+3)" },
  { value: "Asia/Dubai", label: "Дубай (UTC+4)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Novosibirsk", label: "Новосибирск (UTC+7)" },
  { value: "UTC", label: "UTC" },
]

/** Список с текущим значением: если его нет среди вариантов, оно идёт первым как есть */
export function withCurrent(options: readonly SettingOption[], current: string): readonly SettingOption[] {
  return options.some((option) => option.value === current) ? options : [{ value: current, label: current }, ...options]
}
