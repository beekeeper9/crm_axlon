import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { leadsRepository } from "@/features/leads"
import { MeetingsView, MeetingsViewSkeleton } from "@/features/meetings"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Встречи" }

type MeetingsPageProps = PageProps<"/meetings">

async function MeetingsContent({ searchParams }: Pick<MeetingsPageProps, "searchParams">) {
  const [user, params, leadOptions] = await Promise.all([getCurrentUser(), searchParams, leadsRepository.listOptions()])
  return <MeetingsView user={user} params={params} leadOptions={leadOptions} />
}

export default function MeetingsPage({ searchParams }: MeetingsPageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Встречи" description="Расписание встреч с клиентами, подтверждения и итоги" />
      <Suspense fallback={<MeetingsViewSkeleton />}>
        <MeetingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
