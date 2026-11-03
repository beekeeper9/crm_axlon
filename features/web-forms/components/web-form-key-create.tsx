"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWebFormKeyAction } from "@/features/web-forms/actions"

/** Новый ключ для формы сайта выбранного отдела */
export function WebFormKeyCreate({ departmentId }: { departmentId: string }) {
  const router = useRouter()
  const [name, setName] = useState("Сайт")
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createWebFormKeyAction({ name, departmentId })
      if (result.ok) {
        setMessage({ tone: "ok", text: `Ключ «${result.key.name}» создан. Скопируйте код формы ниже и разместите его на сайте.` })
        setName("Сайт")
        router.refresh()
      } else setMessage({ tone: "error", text: result.message })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-border">
      <Label htmlFor="web-form-key-name">Новая форма</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="web-form-key-name"
          value={name}
          maxLength={100}
          onChange={(event) => {
            setName(event.target.value)
            setMessage(null)
          }}
          placeholder="Например, «Сайт» или «Лендинг акции»"
          className="max-w-xs"
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Plus data-icon="inline-start" aria-hidden />}
          Создать ключ
        </Button>
      </div>
      <p aria-live="polite" className="min-h-4 text-xs">
        {message && <span className={message.tone === "ok" ? "text-success" : "text-destructive"}>{message.text}</span>}
      </p>
    </form>
  )
}
