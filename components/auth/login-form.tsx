"use client"

import { useActionState } from "react"
import { CircleAlert, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, type LoginState } from "@/lib/auth/actions"

const INITIAL_STATE: LoginState = { error: null, requestId: null, username: "" }

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [state, formAction, isPending] = useActionState(login, INITIAL_STATE)

  return (
    <form action={formAction} className="grid gap-4">
      {returnTo && <input type="hidden" name="next" value={returnTo} />}
      <div className="grid gap-2">
        <Label htmlFor="login-username">Логин</Label>
        <Input
          id="login-username"
          name="username"
          autoComplete="username"
          defaultValue={state.username}
          required
          autoFocus
          aria-invalid={Boolean(state.error)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="login-password">Пароль</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error)}
        />
      </div>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p>{state.error}</p>
            {state.requestId && <p className="text-xs text-muted-foreground">Код запроса для поддержки: {state.requestId}</p>}
          </div>
        </div>
      )}

      {/* Кнопка блокируется на время запроса — защита от повторной отправки */}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        Войти
      </Button>
    </form>
  )
}
