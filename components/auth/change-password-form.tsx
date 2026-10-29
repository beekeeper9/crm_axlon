"use client"

import { useActionState } from "react"
import { CircleAlert, LoaderCircle } from "lucide-react"

import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { changePassword, type ChangePasswordState } from "@/lib/auth/actions"

const INITIAL_STATE: ChangePasswordState = { error: null, fieldErrors: {} }

type ChangePasswordFormProps = {
  isForced: boolean
  minLength: number
}

export function ChangePasswordForm({ isForced, minLength }: ChangePasswordFormProps) {
  const [state, formAction, isPending] = useActionState(changePassword, INITIAL_STATE)
  const fields = [
    { name: "currentPassword", label: isForced ? "Временный пароль" : "Текущий пароль", autoComplete: "current-password" },
    { name: "newPassword", label: "Новый пароль", autoComplete: "new-password", hint: `Не короче ${minLength} символов и не совпадает с временным` },
    { name: "confirmPassword", label: "Повторите новый пароль", autoComplete: "new-password" },
  ] as const

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {fields.map((field, index) => {
        const error = state.fieldErrors[field.name]
        const hintId = `${field.name}-hint`
        return (
          <div key={field.name} className="grid gap-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            <PasswordInput
              id={field.name}
              name={field.name}
              autoComplete={field.autoComplete}
              autoFocus={index === 0}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error || "hint" in field ? hintId : undefined}
              className="h-10"
            />
            {error ? (
              <p id={hintId} className="text-xs text-destructive">{error}</p>
            ) : "hint" in field ? (
              <p id={hintId} className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        )
      })}

      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-10" disabled={isPending}>
        {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        Сохранить пароль
      </Button>
    </form>
  )
}
