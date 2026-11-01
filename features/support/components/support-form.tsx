"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ActionError, ChoiceSelect, FormField } from "@/features/platform/components/platform-controls"
import { TICKET_KIND_LABELS } from "@/features/platform/labels"
import { TICKET_KINDS, type TicketKind } from "@/features/platform/schemas"
import { sendTicketAction, type SendTicketResult } from "@/features/support/actions"

export function SupportForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [kind, setKind] = useState<TicketKind>("question")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [result, setResult] = useState<SendTicketResult | null>(null)
  const failure = result && !result.ok ? result : null

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const next = await sendTicketAction({ kind, subject, body })
          setResult(next)
          if (next.ok) {
            setSubject("")
            setBody("")
            router.refresh()
          }
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <FormField id="kind" label="Тип">
          <ChoiceSelect id="kind" value={kind} options={TICKET_KINDS.map((k) => ({ value: k, label: TICKET_KIND_LABELS[k] }))} onChange={setKind} />
        </FormField>
        <FormField id="subject" label="Тема" error={failure?.fieldErrors.subject}>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="h-10" />
        </FormField>
      </div>
      <FormField id="body" label="Сообщение" error={failure?.fieldErrors.body} hint="Не указывайте пароли и данные карт">
        <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} />
      </FormField>
      {failure && <ActionError failure={{ ok: false, message: failure.message, fieldErrors: failure.fieldErrors, requestId: failure.requestId }} />}
      {result?.ok && <p className="text-sm text-success">Обращение отправлено. Статус появится в списке ниже.</p>}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Send data-icon="inline-start" aria-hidden />}
        Отправить
      </Button>
    </form>
  )
}
