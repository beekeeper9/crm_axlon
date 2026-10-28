import { z } from "zod"

/** Согласовано с backend: limit от 1 до 200 (по умолчанию 50), offset от 0 */
export const PAGE_LIMIT_DEFAULT = 50
export const PAGE_LIMIT_MAX = 200

export type PageParams = {
  limit: number
  offset: number
}

/** Ответ списка: `{ count, results }`, без next/previous */
export function paginatedSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    count: z.int().nonnegative(),
    results: z.array(item),
  })
}

export type Paginated<TItem> = {
  count: number
  results: TItem[]
}

export type PageInfo = {
  /** Номер страницы с 1 */
  page: number
  pageCount: number
  from: number
  to: number
  count: number
}

export function pageParams(page: number, limit: number = PAGE_LIMIT_DEFAULT): PageParams {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), PAGE_LIMIT_MAX)
  const safePage = Number.isFinite(page) ? Math.max(Math.trunc(page), 1) : 1
  return { limit: safeLimit, offset: (safePage - 1) * safeLimit }
}

/** Страницы считаются из count, limit и offset */
export function pageInfo(count: number, { limit, offset }: PageParams): PageInfo {
  const pageCount = Math.max(Math.ceil(count / limit), 1)
  return {
    page: Math.floor(offset / limit) + 1,
    pageCount,
    from: count === 0 ? 0 : offset + 1,
    to: Math.min(offset + limit, count),
    count,
  }
}

/** Для демо-реализаций: та же форма ответа, что и у backend */
export function paginate<TItem>(items: readonly TItem[], { limit, offset }: PageParams): Paginated<TItem> {
  return { count: items.length, results: items.slice(offset, offset + limit) }
}
