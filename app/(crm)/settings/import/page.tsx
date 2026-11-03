import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { ImportView, ImportViewSkeleton } from "@/features/imports"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Загрузка из файла" }

/** Создавать лиды и клиентов может любой сотрудник продаж; права и область проверяет backend */
async function Content() {
  return <ImportView user={await getCurrentUser()} />
}

export default function Page() {
  return (
    <div className="mx-auto max-w-screen-lg space-y-5">
      <PageHeader title="Загрузка из файла" description="Лиды и клиенты из CSV: сначала проверка дублей, потом загрузка только новых строк" />
      <Suspense fallback={<ImportViewSkeleton />}>
        <Content />
      </Suspense>
    </div>
  )
}
