"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { prospectRoute } from "@/config/routes"
import { createProspectAction } from "@/features/prospects/actions"
import { PROSPECT_SOURCE_LABELS } from "@/features/prospects/lib/prospect-meta"
import { prospectSourceSchema, type ProspectSource } from "@/features/prospects/schemas"

const DEFAULT_SOURCES = prospectSourceSchema.options.map((value) => ({ value, label: PROSPECT_SOURCE_LABELS[value] }))
const EMPTY = { name: "", phone: "", email: "" }

type SourceOption = { value: ProspectSource; label: string }

/** Новый входящий лид; после создания открывается его карточка. Источники — справочник компании (включённые, с её подписями) */
export function NewProspectButton({ sources = DEFAULT_SOURCES }: { sources?: readonly SourceOption[] }) {
  const options = sources.length > 0 ? sources : DEFAULT_SOURCES
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState(EMPTY)
  const [source, setSource] = useState<ProspectSource>(options.find((option) => option.value === "phone")?.value ?? options[0].value)
  const [failure, setFailure] = useState<string | null>(null)
  const field = (key: keyof typeof EMPTY) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        Новый лид
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый лид</DialogTitle>
            <DialogDescription>Заявка до клиента и сделки. Нужен телефон или e-mail — по ним система ищет дубли.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const result = await createProspectAction({ ...values, source })
                if (result.ok) {
                  setOpen(false)
                  setValues(EMPTY)
                  setFailure(null)
                  router.push(prospectRoute(result.data))
                } else setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
              })
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="prospect-name">Имя или название</Label>
              <Input id="prospect-name" {...field("name")} autoFocus maxLength={200} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prospect-phone">Телефон</Label>
              <Input id="prospect-phone" type="tel" {...field("phone")} placeholder="+996555123456" className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prospect-email">E-mail</Label>
              <Input id="prospect-email" type="email" {...field("email")} className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prospect-source">Источник</Label>
              <Select items={options} value={source} onValueChange={(value) => value && setSource(prospectSourceSchema.parse(value))}>
                <SelectTrigger id="prospect-source" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
