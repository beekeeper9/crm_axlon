import { ApiError } from "@/lib/api/errors"

export type LoadResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

/**
 * Загрузка данных для экрана с понятной ошибкой вместо общего «что-то пошло не так».
 * Перехватывает только ApiError (нет связи, нет прав, контракт не согласован…);
 * остальное, включая redirect() и notFound(), летит дальше как обычно.
 */
export async function tryLoad<T>(load: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await load() }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error }
    throw error
  }
}
