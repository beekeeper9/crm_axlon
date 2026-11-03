"use client"

import { useState, useTransition } from "react"
import { CircleCheck, CircleX, LoaderCircle, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { checkIntegrationAction } from "@/features/integrations/actions"
import type { IntegrationCheck, IntegrationProvider } from "@/features/integrations/api/integrations-repository"

/** Запускает проверки на backend и показывает каждую с пояснением — что работает и чего не хватает */
export function IntegrationCheckButton({ provider }: { provider: IntegrationProvider }) {
  const [result, setResult] = useState<IntegrationCheck | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run() {
    setFailure(null)
    startTransition(async () => {
      const response = await checkIntegrationAction(provider)
      if (response.ok) setResult(response.data)
      else setFailure(response.message)
    })
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={run} disabled={isPending}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <ShieldCheck data-icon="inline-start" aria-hidden />}
        Проверить подключение
      </Button>
      {failure && (
        <p role="alert" className="text-meta text-destructive">
          {failure}
        </p>
      )}
      {result && (
        <ul className="space-y-1" aria-live="polite">
          {result.items.map((item) => (
            <li key={item.name} className="text-meta flex items-start gap-1.5">
              {item.ok ? (
                <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Пройдена" />
              ) : (
                <CircleX className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="Не пройдена" />
              )}
              <span>{item.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
