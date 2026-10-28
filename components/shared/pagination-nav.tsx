import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { PageInfo } from "@/lib/api/pagination"
import { formatNumber } from "@/lib/format"

type PaginationNavProps = {
  info: PageInfo
  /** Адрес нужной страницы с сохранением фильтров */
  hrefForPage: (page: number) => string
}

/** Пагинация по count/limit/offset из ответа API */
export function PaginationNav({ info, hrefForPage }: PaginationNavProps) {
  if (info.count === 0) return null
  const hasPrevious = info.page > 1
  const hasNext = info.page < info.pageCount

  return (
    <nav aria-label="Страницы" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {formatNumber(info.from)}–{formatNumber(info.to)} из {formatNumber(info.count)}
      </p>
      {info.pageCount > 1 && (
        <div className="flex items-center gap-1">
          {hasPrevious ? (
            <Link href={hrefForPage(info.page - 1)} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ChevronLeft data-icon="inline-start" aria-hidden />
              Назад
            </Link>
          ) : null}
          <span className="px-2 tabular-nums">
            {formatNumber(info.page)} / {formatNumber(info.pageCount)}
          </span>
          {hasNext ? (
            <Link href={hrefForPage(info.page + 1)} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Далее
              <ChevronRight data-icon="inline-end" aria-hidden />
            </Link>
          ) : null}
        </div>
      )}
    </nav>
  )
}
