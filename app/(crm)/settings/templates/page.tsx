import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TemplatesView, TemplatesViewSkeleton } from "@/features/communications"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Шаблоны сообщений" }

async function Content() {
  return <TemplatesView user={await getCurrentUser()} />
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Шаблоны сообщений" description="Частые ответы клиентам: менеджеры вставляют их в переписку в карточке клиента" />
      <Suspense fallback={<TemplatesViewSkeleton />}>
        <Content />
      </Suspense>
    </div>
  )
}
