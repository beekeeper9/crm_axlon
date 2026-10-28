/** Фильтры списков хранятся в адресе: ссылкой можно поделиться, «назад» работает. */

export type SearchParamsRecord = Record<string, string | string[] | undefined>

export type ParamPatch = Record<string, string | null | undefined>

export function getParam(params: SearchParamsRecord, key: string): string | null {
  const value = params[key]
  const single = Array.isArray(value) ? value[0] : value
  return single ? single : null
}

export function getPageParam(params: SearchParamsRecord): number {
  const page = Number(getParam(params, "page") ?? "1")
  return Number.isInteger(page) && page > 0 ? page : 1
}

/**
 * Новый адрес с изменёнными параметрами. null или пустая строка удаляют параметр.
 * Любое изменение фильтров, кроме самой страницы, возвращает на первую страницу.
 */
export function applyParamPatch(current: URLSearchParams, patch: ParamPatch): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  if (!("page" in patch)) next.delete("page")
  return next
}

export function toUrlSearchParams(params: SearchParamsRecord): URLSearchParams {
  const result = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single) result.set(key, single)
  }
  return result
}

export function hrefWithParams(pathname: string, params: SearchParamsRecord, patch: ParamPatch): string {
  const query = applyParamPatch(toUrlSearchParams(params), patch).toString()
  return query ? `${pathname}?${query}` : pathname
}
