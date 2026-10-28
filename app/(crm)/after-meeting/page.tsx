import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { AfterMeetingView, AfterMeetingViewSkeleton } from "@/features/after-meeting"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "После встречи" }

type AfterMeetingPageProps = PageProps<"/after-meeting">

async function AfterMeetingContent({ searchParams }: Pick<AfterMeetingPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <AfterMeetingView user={user} params={params} />
}

export default function AfterMeetingPage({ searchParams }: AfterMeetingPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title="После встречи" description="Запишите итог, договорённости и следующий шаг, пока детали свежие" />
      <Suspense fallback={<AfterMeetingViewSkeleton />}>
        <AfterMeetingContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
