import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"
import { getParam, type SearchParamsRecord } from "@/lib/search-params"

export type Period = { from: string; to: string; month: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Период фильтра «с — по» из адреса (`?from=&to=`), по умолчанию — с начала текущего месяца
 * компании по сегодня. Месяц плана — месяц даты «по».
 */
export function periodFrom(params: SearchParamsRecord, today = companyDateOf(nowIso())): Period {
  const fromParam = getParam(params, "from")
  const toParam = getParam(params, "to")
  const to = toParam && DATE.test(toParam) ? toParam : today
  const from = fromParam && DATE.test(fromParam) && fromParam <= to ? fromParam : `${to.slice(0, 7)}-01`
  return { from, to, month: to.slice(0, 7) }
}
