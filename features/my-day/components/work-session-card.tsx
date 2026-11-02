"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Play, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { WorkSession } from "@/features/my-day/api/my-day-server"
import { workSessionAction } from "@/features/my-day/actions"
import { formatTime } from "@/lib/format"

/** Начало и конец работы отмечает сам сотрудник (это не вход в систему) */
export function WorkSessionCard({ session }: { session: WorkSession | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const isOpen = session !== null

  function toggle() {
    startTransition(async () => {
      const error = await workSessionAction(isOpen ? "stop" : "start")
      setFailure(error)
      if (!error) router.refresh()
    })
  }

  return (
    <section aria-label="Рабочая смена" className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-border">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{isOpen ? `Смена идёт с ${formatTime(session.startedAt)}` : "Смена не начата"}</p>
        <p className="text-meta text-muted-foreground">
          {isOpen ? "Завершите смену, когда закончите работу." : "Отметьте начало работы — по сменам считается рабочее время."}
        </p>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
      </div>
      <Button onClick={toggle} disabled={isPending} variant={isOpen ? "outline" : "default"}>
        {isPending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : isOpen ? (
          <Square data-icon="inline-start" aria-hidden />
        ) : (
          <Play data-icon="inline-start" aria-hidden />
        )}
        {isOpen ? "Завершить смену" : "Начать смену"}
      </Button>
    </section>
  )
}
