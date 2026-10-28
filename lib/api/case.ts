/**
 * Преобразование имён полей между backend (snake_case) и приложением (camelCase).
 * Выполняется только в API-клиенте: компоненты и схемы модулей работают с camelCase.
 */

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
}

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert))
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [convert(key), convertKeys(item, convert)])
  )
}

/** Ответ backend → модель приложения */
export function keysToCamel(value: unknown): unknown {
  return convertKeys(value, snakeToCamel)
}

/** Тело запроса и параметры приложения → формат backend */
export function keysToSnake(value: unknown): unknown {
  return convertKeys(value, camelToSnake)
}
