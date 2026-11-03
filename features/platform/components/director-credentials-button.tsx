"use client"

import { useState, useTransition } from "react"
import { KeyRound, LoaderCircle } from "lucide-react"

import { CredentialsCard } from "@/components/shared/credentials-card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { issueDirectorCredentialsAction } from "@/features/platform/actions"

type DirectorCredentialsButtonProps = {
  companyId: string
  companyName: string
  director: { userId: string; fullName: string }
  /** Подпись кнопки: «Сбросить пароль» в карточке, «Сгенерировать заново» после создания */
  label?: string
}

/**
 * Новый временный пароль директора: если он забыл пароль или первые данные не успели передать.
 * Подтверждение обязательно — старый пароль и открытые сессии директора перестают работать.
 */
export function DirectorCredentialsButton({ companyId, companyName, director, label = "Сбросить пароль" }: DirectorCredentialsButtonProps) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle")
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ login: string; temporaryPassword: string } | null>(null)

  function issue() {
    startTransition(async () => {
      const result = await issueDirectorCredentialsAction(companyId, director.userId)
      if (result.ok) {
        setCredentials(result.data)
        setFailure(null)
        setStep("done")
      } else setFailure(result.message)
    })
  }

  function close() {
    setStep("idle")
    setCredentials(null)
    setFailure(null)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setStep("confirm")}>
        <KeyRound data-icon="inline-start" aria-hidden />
        {label}
      </Button>
      <Dialog open={step !== "idle"} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-lg">
          {step === "done" && credentials ? (
            <CredentialsCard
              title="Новые данные для входа"
              description="Передайте директору. Пароль показывается только сейчас; при входе система попросит его сменить."
              login={credentials.login}
              temporaryPassword={credentials.temporaryPassword}
              rows={[
                { label: "Компания", value: companyName },
                { label: "Директор", value: director.fullName },
              ]}
              actions={
                <Button variant="outline" onClick={close}>
                  Готово
                </Button>
              }
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Выдать новый временный пароль?</DialogTitle>
                <DialogDescription>
                  {director.fullName}, «{companyName}». Текущий пароль директора и все его открытые сессии перестанут работать.
                </DialogDescription>
              </DialogHeader>
              {failure && (
                <p role="alert" className="text-sm text-destructive">
                  {failure}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Отмена
                </Button>
                <Button onClick={issue} disabled={isPending}>
                  {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                  Выдать пароль
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
