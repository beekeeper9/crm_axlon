import Link from "next/link"
import { FlaskConical } from "lucide-react"

import { AllSectionsMenu } from "@/components/layout/all-sections-menu"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AssistantLink, PrimaryNav } from "@/components/layout/nav-links"
import { UserMenu } from "@/components/layout/user-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { siteConfig } from "@/config/site"
import { getCurrentUser } from "@/lib/session/current-user"

const HEADER_CLASSES =
  "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-4"

function BrandLink() {
  return (
    <Link
      href={routes.myDay}
      className="flex shrink-0 items-center gap-2 rounded-md pr-2 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        {siteConfig.name.slice(0, 1)}
      </span>
      <span className="hidden text-sm font-semibold sm:inline">{siteConfig.name}</span>
    </Link>
  )
}

/** Верхняя панель: основные разделы, каталог «Все разделы», ИИ-помощник и профиль. */
export async function AppHeader() {
  const user = await getCurrentUser()

  return (
    <header className={HEADER_CLASSES}>
      <MobileNav role={user.role} />
      <BrandLink />
      <div className="mx-1 hidden h-5 w-px bg-border lg:block" aria-hidden />
      <PrimaryNav role={user.role} />
      <AllSectionsMenu role={user.role} />
      <AssistantLink />

      <div className="ml-auto flex items-center gap-2">
        {isMockDataSource && (
          <span
            className="hidden h-6 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 text-xs font-medium whitespace-nowrap text-warning sm:inline-flex"
            title="Интерфейс работает на демонстрационных данных. Backend ещё не подключён."
          >
            <FlaskConical className="size-3.5" aria-hidden />
            Демо-данные
          </span>
        )}
        <UserMenu user={user} isDemoData={isMockDataSource} />
      </div>
    </header>
  )
}

export function AppHeaderSkeleton() {
  return (
    <header className={HEADER_CLASSES} aria-busy="true">
      <BrandLink />
      <Skeleton className="hidden h-6 w-[28rem] lg:block" />
      <Skeleton className="ml-auto size-7 rounded-full" />
    </header>
  )
}
