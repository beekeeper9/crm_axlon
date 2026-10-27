"use client"

import { RotateCw } from "lucide-react"

import { ErrorState } from "@/components/shared/error-state"
import { Button } from "@/components/ui/button"

type AppErrorProps = {
  error: unknown
  retry: () => void
}

/** Последний рубеж: ошибка в самом каркасе (например, не удалось получить пользователя). */
export default function AppError({ retry }: AppErrorProps) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ErrorState
        title="Не удалось загрузить приложение"
        action={
          <Button variant="outline" size="sm" onClick={() => retry()}>
            <RotateCw data-icon="inline-start" aria-hidden />
            Повторить
          </Button>
        }
      />
    </main>
  )
}
