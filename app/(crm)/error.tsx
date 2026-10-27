"use client"

import { RotateCw } from "lucide-react"

import { ErrorState } from "@/components/shared/error-state"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type CrmErrorProps = {
  error: unknown
  retry: () => void
}

/** Ошибка страницы внутри каркаса: меню и шапка остаются доступными. */
export default function CrmError({ retry }: CrmErrorProps) {
  return (
    <Card>
      <ErrorState
        title="Не удалось открыть страницу"
        action={
          <Button variant="outline" size="sm" onClick={() => retry()}>
            <RotateCw data-icon="inline-start" aria-hidden />
            Повторить
          </Button>
        }
      />
    </Card>
  )
}
