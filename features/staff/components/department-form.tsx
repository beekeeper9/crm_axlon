"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createDepartmentAction } from "@/features/staff/actions"

/** Новый отдел продаж (директор). Руководителя назначают при создании РОПа */
export function DepartmentForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await createDepartmentAction(name)
          if (result.ok) {
            setName("")
            setMessage({ ok: true, text: `Отдел «${result.data.name}» создан. Теперь назначьте ему РОПа.` })
            router.refresh()
          } else setMessage({ ok: false, text: result.message })
        })
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название нового отдела" aria-label="Название нового отдела" maxLength={100} className="h-9 w-64" />
      <Button type="submit" variant="outline" size="lg" disabled={isPending || name.trim().length < 2}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Plus data-icon="inline-start" aria-hidden />}
        Создать отдел
      </Button>
      {message && <p className={`basis-full text-xs ${message.ok ? "text-success" : "text-destructive"}`}>{message.text}</p>}
    </form>
  )
}
