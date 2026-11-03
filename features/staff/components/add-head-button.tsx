"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleAlert, UserPlus } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { routes } from "@/config/routes"
import { NO_DEPARTMENT_MESSAGE } from "@/features/staff/lib/staff-messages"

/**
 * «Добавить РОПа»: РОПа назначают только в существующий отдел. Пока отделов нет, кнопка
 * не открывает форму, а объясняет порядок действий (backend проверяет то же правило).
 */
export function AddHeadButton({ hasDepartments }: { hasDepartments: boolean }) {
  const [blocked, setBlocked] = useState(false)
  if (hasDepartments) {
    return (
      <Link href={routes.staffNew} className={buttonVariants({ size: "lg" })}>
        <UserPlus data-icon="inline-start" aria-hidden />
        Добавить РОПа
      </Link>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button size="lg" onClick={() => setBlocked(true)} aria-describedby={blocked ? "add-head-blocked" : undefined}>
        <UserPlus data-icon="inline-start" aria-hidden />
        Добавить РОПа
      </Button>
      {blocked && (
        <p id="add-head-blocked" role="alert" className="flex max-w-xs items-start gap-1.5 text-right text-sm text-warning">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {NO_DEPARTMENT_MESSAGE}
        </p>
      )}
    </div>
  )
}
