/**
 * Excel в русской локали сохраняет CSV в windows-1251, другие программы — в UTF-8.
 * Сначала строгий UTF-8; если байты в нём недопустимы — windows-1251. BOM декодер убирает сам.
 */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder("windows-1251").decode(bytes)
  }
}

/**
 * Файл уходит на сервер интерфейса через server action (лимит тела — 1 МБ) дважды:
 * на проверку и на загрузку. Backend принимает до 2000 строк — это заметно меньше лимита.
 */
export const MAX_IMPORT_FILE_BYTES = 900 * 1024

export function isCsvFile(file: { name: string; type: string }): boolean {
  return /\.(csv|txt)$/i.test(file.name) || file.type === "text/csv"
}
