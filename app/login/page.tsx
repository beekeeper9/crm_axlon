import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { buttonVariants } from "@/components/ui/button"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Вход" }

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams
  return <LoginForm returnTo={typeof next === "string" ? next : null} />
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  if (isMockDataSource) {
    return (
      <AuthShell title="Вход не нужен" description="Приложение работает на демонстрационных данных: backend не подключён.">
        <Link href={routes.myDay} className={buttonVariants({ size: "lg", className: "w-full" })}>
          Открыть «Мой день»
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Вход" description="Войдите под учётной записью вашей компании">
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  )
}
