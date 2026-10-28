import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TasksView, TasksViewSkeleton } from "@/features/tasks"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Задачи" }

type TasksPageProps = PageProps<"/tasks">

async function TasksContent({ searchParams }: Pick<TasksPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <TasksView user={user} params={params} />
}

export default function TasksPage({ searchParams }: TasksPageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Задачи" description="Следующие шаги по клиентам и поручения руководителя" />
      <Suspense fallback={<TasksViewSkeleton />}>
        <TasksContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
