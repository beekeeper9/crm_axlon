import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { PASSWORD_MIN_LENGTH } from "@/config/auth"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { homeRouteFor } from "@/config/navigation"
import { routes } from "@/config/routes"
import { signOut } from "@/lib/auth/actions"
import { getSessionState } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Смена пароля" }

async function ChangePasswordContent() {
  const session = await getSessionState()
  if (!session) redirect(`${routes.login}?reason=expired`)
  const isForced = session.mustChangePassword

  return (
    <>
      {isForced && (
        <p className="rounded-lg bg-primary/10 px-3 py-2.5 text-sm text-primary">
          {session.user.fullName}, вы вошли по временному паролю. Придумайте свой — после этого откроется рабочий кабинет.
        </p>
      )}
      <ChangePasswordForm isForced={isForced} minLength={PASSWORD_MIN_LENGTH} />
      <div className="flex justify-between gap-3 text-meta">
        {isForced ? (
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground hover:text-foreground">
              Выйти
            </button>
          </form>
        ) : (
          <Link href={homeRouteFor(session.user.role)} className="text-muted-foreground hover:text-foreground">
            Отмена
          </Link>
        )}
      </div>
    </>
  )
}

export default function ChangePasswordPage() {
  return (
    <AuthShell title="Смена пароля" description="Пароль знаете только вы — руководитель его не видит">
      <Suspense>
        <ChangePasswordContent />
      </Suspense>
    </AuthShell>
  )
}
