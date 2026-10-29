import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { homeRouteFor } from "@/config/navigation"
import { routes } from "@/config/routes"
import { MyDayView, MyDayViewSkeleton } from "@/features/my-day"
import { nowIso } from "@/lib/clock"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam } from "@/lib/search-params"
import { getCurrentUser } from "@/lib/session/current-user"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Мой день" }

type MyDayPageProps = PageProps<"/my-day">

const monthLabelFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" })

function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, value - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

function monthLabel(month: string): string {
  const label = monthLabelFormat.format(new Date(`${month}-01T00:00:00Z`)).replace(" г.", "")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * «Мой день» — личное пространство менеджера по продажам.
 * У руководителя своя стартовая страница — «Кабинет РОПа»; сюда он перенаправляется.
 */
async function MyDayContent({ searchParams }: Pick<MyDayPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "my_day.view")) redirect(homeRouteFor(user.role))

  const currentMonth = nowIso().slice(0, 7)
  const requested = getParam(params, "month")
  const month = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= currentMonth ? requested : currentMonth
  const monthHref = (value: string) => (value === currentMonth ? routes.myDay : `${routes.myDay}?month=${value}`)
  const canGoForward = month < currentMonth
  const navButton = buttonVariants({ variant: "outline", size: "icon" })

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Мой день</h1>
          <span className="text-meta text-muted-foreground">{user.fullName}</span>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Месяц" className="flex items-center gap-1.5">
            <Link href={monthHref(shiftMonth(month, -1))} className={navButton} aria-label="Предыдущий месяц" scroll={false}>
              <ChevronLeft aria-hidden />
            </Link>
            <span className="min-w-28 text-center text-sm font-medium" aria-live="polite">
              {monthLabel(month)}
            </span>
            {canGoForward ? (
              <Link href={monthHref(shiftMonth(month, 1))} className={navButton} aria-label="Следующий месяц" scroll={false}>
                <ChevronRight aria-hidden />
              </Link>
            ) : (
              <span className={cn(navButton, "pointer-events-none opacity-40")} aria-hidden>
                <ChevronRight />
              </span>
            )}
          </nav>
          <Link href={routes.focus} className={buttonVariants()}>
            В работу
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Link>
        </div>
      </header>
      <MyDayView userId={user.id} month={month} />
    </>
  )
}

export default function MyDayPage({ searchParams }: MyDayPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Suspense fallback={<MyDayViewSkeleton />}>
        <MyDayContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
