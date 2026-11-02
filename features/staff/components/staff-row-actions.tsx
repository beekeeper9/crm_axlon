"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, LoaderCircle, UserX } from "lucide-react"

import { CredentialsCard } from "@/components/shared/credentials-card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deactivateStaffAction, resetStaffPasswordAction } from "@/features/staff/actions"
import type { StaffMember } from "@/features/staff/schemas"
import { ROLE_LABELS } from "@/lib/permissions/roles"

type StaffRowActionsProps = {
  member: StaffMember
  /** Отключение показывается тем, кто может нанимать (директор, РОП — для своих менеджеров) */
  canDeactivate: boolean
}

/** Сброс пароля и отключение сотрудника. Право окончательно проверяет backend */
export function StaffRowActions({ member, canDeactivate }: StaffRowActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function reset() {
    startTransition(async () => {
      const result = await resetStaffPasswordAction(member.id)
      if (result.ok) {
        setFailure(null)
        setPassword(result.data)
      } else setFailure(result.message)
    })
  }

  function deactivate() {
    startTransition(async () => {
      const result = await deactivateStaffAction(member.id)
      if (result.ok) {
        setConfirming(false)
        router.refresh()
      } else setFailure(result.message)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={reset} disabled={isPending} title="Выдать новый временный пароль">
          {isPending && !confirming ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <KeyRound data-icon="inline-start" aria-hidden />}
          Пароль
        </Button>
        {canDeactivate && (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={isPending} title="Отключить аккаунт">
            <UserX data-icon="inline-start" aria-hidden />
            Отключить
          </Button>
        )}
      </div>
      {failure && <p className="max-w-56 text-right text-xs text-destructive">{failure}</p>}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отключить {member.fullName}?</DialogTitle>
            <DialogDescription>
              Сотрудник не сможет войти. Его открытые задачи и сделки перейдут к вам; история, клиенты и закрытые сделки сохранятся.
            </DialogDescription>
          </DialogHeader>
          {failure && <p className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={deactivate} disabled={isPending}>
              {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              Отключить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={password !== null} onOpenChange={(open) => !open && setPassword(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Новый временный пароль</DialogTitle>
          </DialogHeader>
          {password && (
            <CredentialsCard
              title="Пароль сброшен"
              description="Старый пароль и открытые сессии больше не работают. Новый пароль показывается только сейчас."
              login={member.login}
              temporaryPassword={password}
              rows={[
                { label: "Сотрудник", value: member.fullName },
                { label: "Роль", value: [ROLE_LABELS[member.role], member.department?.name].filter(Boolean).join(" · ") },
              ]}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
