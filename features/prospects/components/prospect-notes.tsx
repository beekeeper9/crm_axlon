"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addProspectNoteAction } from "@/features/prospects/actions"

/** Новое примечание к лиду; список примечаний рисует сервер (после сохранения — обновление) */
export function ProspectNoteForm({ prospectId }: { prospectId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [body, setBody] = useState("")
  const [failure, setFailure] = useState<string | null>(null)

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await addProspectNoteAction(prospectId, body)
          if (!result.ok) {
            setFailure(result.message)
            return
          }
          setFailure(null)
          setBody("")
          router.refresh()
        })
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        maxLength={4000}
        placeholder="Например: просил перезвонить после обеда, интересует рассрочка"
        aria-label="Новое примечание"
      />
      {failure && (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      )}
      <Button type="submit" size="sm" variant="outline" disabled={isPending || body.trim().length < 2} className="w-fit">
        {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        Добавить примечание
      </Button>
    </form>
  )
}
