"use client"

import { useActionState } from "react"
import { CircleAlert, LoaderCircle } from "lucide-react"

import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, type LoginState } from "@/lib/auth/actions"

const INITIAL_STATE: LoginState = { error: null, requestId: null, login: "" }

/** Форма входа: Enter отправляет форму, кнопка блокируется на время запроса */
export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [state, formAction, isPending] = useActionState(login, INITIAL_STATE)
  const fieldError = state.error && (state.error.kind === "invalid" || state.error.kind === "validation")

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {returnTo && <input type="hidden" name="next" value={returnTo} />}
      <div className="grid gap-1.5">
        <Label htmlFor="login-login">Логин</Label>
        <Input
          id="login-login"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.login}
          required
          autoFocus
          aria-invalid={Boolean(fieldError)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-10"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="login-password">Пароль</Label>
        <PasswordInput
          id="login-password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldError)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-10"
        />
      </div>

      {state.error && (
        <div id="login-error" role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-0.5">
            <p>{state.error.message}</p>
            {state.requestId && <p className="text-xs text-muted-foreground">Код запроса для поддержки: {state.requestId}</p>}
          </div>
        </div>
      )}

      <Button type="submit" size="lg" className="h-10" disabled={isPending}>
        {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        {isPending ? "Входим…" : "Войти"}
      </Button>
    </form>
  )
}
