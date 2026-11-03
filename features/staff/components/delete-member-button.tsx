"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { routes } from "@/config/routes"
import { deleteStaffAction } from "@/features/staff/actions"

/** Удаление аккаунта без истории работы — с подтверждением; backend ещё раз проверяет историю */
export function DeleteMemberButton({ membershipId, fullName }: { membershipId: string; fullName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <Button variant="destructive" size="lg" onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" aria-hidden />
        Удалить аккаунт
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить аккаунт навсегда?</DialogTitle>
            <DialogDescription>
              {fullName}: у сотрудника нет лидов, клиентов, сделок и истории работы. Аккаунт и вход будут удалены без возможности восстановления.
            </DialogDescription>
          </DialogHeader>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteStaffAction(membershipId)
                  if (result.ok) router.push(routes.staff)
                  else setFailure(result.message)
                })
              }
            >
              {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
