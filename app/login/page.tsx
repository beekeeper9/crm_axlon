import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { FlaskConical, Info } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { homeRouteFor } from "@/config/navigation"
import { routes } from "@/config/routes"
import { getSessionState } from "@/lib/session/current-user"
import { demoLoginHints } from "@/lib/session/demo-login-hints"

export const metadata: Metadata = { title: "Вход" }

type LoginPageProps = PageProps<"/login">

const REASONS: Record<string, string> = {
  expired: "Сессия истекла. Войдите снова, чтобы продолжить.",
  password_changed: "Пароль изменён. Войдите с новым паролем.",
}

async function LoginContent({ searchParams }: Pick<LoginPageProps, "searchParams">) {
  const [{ next, reason }, session] = await Promise.all([searchParams, getSessionState()])
  // Уже вошли — сразу в рабочий кабинет (или на обязательную смену пароля)
  if (session) redirect(session.mustChangePassword ? routes.changePassword : homeRouteFor(session.user.role))
  const notice = typeof reason === "string" ? REASONS[reason] : undefined

  return (
    <>
      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {notice}
        </p>
      )}
      <LoginForm returnTo={typeof next === "string" ? next : null} />
    </>
  )
}

function DemoHints() {
  const hints = demoLoginHints()
  if (hints.length === 0) return null
  return (
    <details className="rounded-xl border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-meta">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-warning select-none">
        <FlaskConical className="size-3.5" aria-hidden />
        Демо-режим: тестовые учётные записи
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Вымышленные аккаунты для проверки сценариев. Роль определяет система после входа — выбирать её не нужно.
      </p>
      <dl className="mt-2 space-y-1">
        {hints.map((hint) => (
          <div key={hint.login} className="grid grid-cols-[9rem_1fr] gap-2">
            <dt className="text-muted-foreground">{hint.label}</dt>
            <dd className="font-mono text-xs leading-5">
              {hint.login} · {hint.password}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthShell title="Вход в аккаунт" description="Аккаунт выдаёт руководитель или администратор компании" footer={<DemoHints />}>
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  )
}
