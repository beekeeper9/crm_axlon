import { CloudOff, Lock, PlugZap, SearchX, ServerCrash, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { ApiError, ApiErrorKind } from "@/lib/api/errors"

const STATES: Record<ApiErrorKind, { icon: LucideIcon; title: string; description: string }> = {
  contract_pending: {
    icon: PlugZap,
    title: "Раздел ещё не подключён к серверу",
    description: "Интерфейс готов, но обмен данными с backend для него ещё не согласован. В демо-режиме раздел работает на примерах.",
  },
  forbidden: {
    icon: Lock,
    title: "Нет доступа",
    description: "У вашей роли нет прав на эти данные. Если они нужны для работы, обратитесь к руководителю.",
  },
  unauthorized: { icon: Lock, title: "Сессия истекла", description: "Войдите снова, чтобы продолжить." },
  network: { icon: CloudOff, title: "Нет связи с сервером", description: "Проверьте интернет и обновите страницу." },
  not_found: { icon: SearchX, title: "Данные не найдены", description: "Возможно, запись удалена или ссылка устарела." },
  validation: { icon: ServerCrash, title: "Запрос не принят", description: "Сервер отклонил параметры запроса. Сбросьте фильтры и попробуйте снова." },
  invalid_response: {
    icon: ServerCrash,
    title: "Сервер ответил в неожиданном формате",
    description: "Скорее всего, версии приложения и сервера разошлись. Сообщите администратору.",
  },
  server: { icon: ServerCrash, title: "Сервер временно недоступен", description: "Попробуйте обновить страницу через минуту." },
}

type ApiErrorStateProps = {
  error: ApiError
  /** Внутри панели (без собственной рамки) */
  bare?: boolean
}

/** Объясняет, что именно случилось, и показывает код запроса для поддержки */
export function ApiErrorState({ error, bare = false }: ApiErrorStateProps) {
  const state = STATES[error.kind]
  const body = (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <state.icon className="size-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium">{state.title}</p>
        <p className="text-meta text-muted-foreground">{state.description}</p>
        {error.requestId && <p className="text-xs text-muted-foreground">Код запроса: {error.requestId}</p>}
      </div>
    </div>
  )
  return bare ? body : <Card className="py-0">{body}</Card>
}
