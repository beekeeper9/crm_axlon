"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClientAction } from "@/features/clients/actions"
import { NEW_CLIENT_ID } from "@/features/clients/lib/new-client"

/** Новый клиент; после создания открывается его карточка в панели (openHref содержит NEW_CLIENT_ID) */
export function NewClientButton({ openHref }: { openHref: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState({ name: "", phone: "", email: "" })
  const [failure, setFailure] = useState<string | null>(null)
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus data-icon="inline-start" aria-hidden />
        Новый клиент
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const result = await createClientAction(values)
                if (result.ok) {
                  setOpen(false)
                  setValues({ name: "", phone: "", email: "" })
                  router.push(openHref.replace(NEW_CLIENT_ID, encodeURIComponent(result.data)), { scroll: false })
                } else setFailure(result.message)
              })
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="client-name">Имя или название</Label>
              <Input id="client-name" {...field("name")} autoFocus maxLength={200} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-phone">Телефон</Label>
              <Input id="client-phone" type="tel" {...field("phone")} placeholder="+996555123456" className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-email">E-mail</Label>
              <Input id="client-email" type="email" {...field("email")} className="h-9" />
            </div>
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
