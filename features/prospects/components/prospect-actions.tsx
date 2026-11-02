"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, BadgeCheck, Ban, LoaderCircle, Pencil, Repeat2, UserRoundCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { leadRoute, routes } from "@/config/routes"
import {
  assignProspectAction,
  convertProspectAction,
  disqualifyProspectAction,
  qualifyProspectAction,
  updateProspectAction,
  type ProspectActionResult,
} from "@/features/prospects/actions"
import type { Prospect } from "@/features/prospects/schemas"

type Person = { id: string; name: string }
type Mode = "idle" | "edit" | "disqualify" | "assign" | "convert"

type ProspectActionsProps = {
  prospect: Prospect
  /** Кому можно передать лид; пусто — передавать нельзя */
  members: readonly Person[]
  /** Существующие клиенты с тем же телефоном или e-mail */
  customerCandidates: readonly { id: string; name: string; contact: string | null }[]
}

const NEW_CUSTOMER = "new"

/** Работа с входящим лидом. Переходы статусов и права окончательно проверяет backend */
export function ProspectActions({ prospect, members, customerCandidates }: ProspectActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>("idle")
  const [failure, setFailure] = useState<string | null>(null)
  const [converted, setConverted] = useState<{ customerId: string; dealId: string | null; alreadyConverted: boolean } | null>(null)

  const [contacts, setContacts] = useState({ name: prospect.name, phone: prospect.phone ?? "", email: prospect.email ?? "" })
  const [reason, setReason] = useState("")
  const [owner, setOwner] = useState<string | null>(prospect.owner.id)
  const [customer, setCustomer] = useState<string>(customerCandidates[0]?.id ?? NEW_CUSTOMER)
  const [withDeal, setWithDeal] = useState(true)
  const [deal, setDeal] = useState({ title: prospect.name, amount: "" })

  function act<T>(operation: () => Promise<ProspectActionResult<T>>, after?: (data: T) => void) {
    startTransition(async () => {
      const result = await operation()
      if (!result.ok) {
        setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
        return
      }
      setFailure(null)
      setMode("idle")
      after?.(result.data)
      router.refresh()
    })
  }

  const toggle = (next: Mode) => {
    setFailure(null)
    setMode(mode === next ? "idle" : next)
  }
  const isQualified = prospect.status === "qualified"
  const contactField = (key: keyof typeof contacts) => ({
    value: contacts[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setContacts((current) => ({ ...current, [key]: event.target.value })),
  })

  if (converted) {
    return (
      <section className="space-y-2 rounded-lg bg-success/10 px-3 py-2 text-sm" aria-live="polite">
        <p>{converted.alreadyConverted ? "Лид уже был конвертирован раньше — новая сделка не создана." : "Лид стал клиентом."}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`${routes.clientBase}?client=${encodeURIComponent(converted.customerId)}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Открыть клиента
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          {converted.dealId && (
            <Link href={leadRoute(converted.dealId)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Открыть сделку
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3" aria-label="Действия с лидом">
      <div className="flex flex-wrap gap-2">
        {isQualified ? (
          <Button size="sm" onClick={() => toggle("convert")} disabled={isPending}>
            <Repeat2 data-icon="inline-start" aria-hidden />
            Конвертировать в клиента
          </Button>
        ) : (
          <Button size="sm" onClick={() => act(() => qualifyProspectAction(prospect.id))} disabled={isPending}>
            {isPending && mode === "idle" ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : (
              <BadgeCheck data-icon="inline-start" aria-hidden />
            )}
            Квалифицировать
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => toggle("edit")} disabled={isPending}>
          <Pencil data-icon="inline-start" aria-hidden />
          Изменить
        </Button>
        {members.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => toggle("assign")} disabled={isPending}>
            <UserRoundCog data-icon="inline-start" aria-hidden />
            Передать
          </Button>
        )}
        {prospect.status !== "unqualified" && (
          <Button size="sm" variant="ghost" onClick={() => toggle("disqualify")} disabled={isPending}>
            <Ban data-icon="inline-start" aria-hidden />
            Не подходит
          </Button>
        )}
      </div>
      {!isQualified && <p className="text-meta text-muted-foreground">Конвертировать в клиента можно после квалификации.</p>}

      {mode === "edit" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            act(() => updateProspectAction(prospect.id, contacts, prospect.version))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="prospect-edit-name">Имя или название</Label>
            <Input id="prospect-edit-name" {...contactField("name")} maxLength={200} className="h-9" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="prospect-edit-phone">Телефон</Label>
              <Input id="prospect-edit-phone" type="tel" {...contactField("phone")} placeholder="+996555123456" className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prospect-edit-email">E-mail</Label>
              <Input id="prospect-edit-email" type="email" {...contactField("email")} className="h-9" />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            Сохранить
          </Button>
        </form>
      )}

      {mode === "disqualify" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            act(() => disqualifyProspectAction(prospect.id, reason))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="prospect-reason">Почему не подходит</Label>
            <Textarea id="prospect-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={isPending} className="w-fit">
            Отметить как неподходящий
          </Button>
        </form>
      )}

      {mode === "assign" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            if (owner) act(() => assignProspectAction(prospect.id, owner))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="prospect-owner">Ответственный</Label>
            <Select items={members.map((m) => ({ value: m.id, label: m.name }))} value={owner} onValueChange={setOwner}>
              <SelectTrigger id="prospect-owner" className="h-9 w-full">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={isPending || !owner || owner === prospect.owner.id} className="w-fit">
            Передать
          </Button>
        </form>
      )}

      {mode === "convert" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            act(
              () =>
                convertProspectAction(prospect.id, {
                  customerId: customer === NEW_CUSTOMER ? null : customer,
                  deal: withDeal ? deal : null,
                }),
              setConverted
            )
          }}
        >
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">Клиент</legend>
            {customerCandidates.map((candidate) => (
              <label key={candidate.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="convert-customer"
                  checked={customer === candidate.id}
                  onChange={() => setCustomer(candidate.id)}
                  className="size-4 accent-(--primary)"
                />
                Привязать к существующему: {candidate.name}
                {candidate.contact && <span className="text-muted-foreground tabular-nums">{candidate.contact}</span>}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="convert-customer"
                checked={customer === NEW_CUSTOMER}
                onChange={() => setCustomer(NEW_CUSTOMER)}
                className="size-4 accent-(--primary)"
              />
              Создать нового клиента
            </label>
            {customerCandidates.length > 0 && (
              <p className="text-meta text-muted-foreground">Если это тот же человек, привяжите к существующему — так не появится вторая карточка.</p>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withDeal} onChange={(event) => setWithDeal(event.target.checked)} className="size-4 accent-(--primary)" />
            Сразу открыть сделку
          </label>
          {withDeal && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="convert-deal-title">Название сделки</Label>
                <Input id="convert-deal-title" value={deal.title} onChange={(e) => setDeal((d) => ({ ...d, title: e.target.value }))} maxLength={200} className="h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="convert-deal-amount">Сумма</Label>
                <Input
                  id="convert-deal-amount"
                  value={deal.amount}
                  onChange={(e) => setDeal((d) => ({ ...d, amount: e.target.value }))}
                  inputMode="decimal"
                  placeholder="15000"
                  className="h-9"
                />
              </div>
            </div>
          )}
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Конвертировать
          </Button>
        </form>
      )}

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </section>
  )
}
