"use client"

import { useState, useTransition } from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setPayTermsAction } from "@/features/staff/actions"
import type { PayTerms } from "@/features/staff/api/compensation"

type PayTermsFormProps = {
  membershipId: string
  userId: string
  terms: PayTerms | null
  /** Валюта компании, если условия уже заданы; иначе подпись без кода */
  currency: string | null
}

/** Оклад и процент с продаж: из них в «Моём дне» менеджера считается его заработок за месяц */
export function PayTermsForm({ membershipId, userId, terms, currency }: PayTermsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null)
  const [values, setValues] = useState({
    baseSalary: terms ? String(Number(terms.baseSalary)) : "",
    commissionPercent: terms ? String(Number(terms.commissionPercent)) : "",
  })
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await setPayTermsAction(membershipId, userId, values)
          setMessage(result.ok ? { tone: "success", text: "Сохранено: заработок в «Моём дне» пересчитан." } : { tone: "error", text: result.message })
        })
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="pay-base">Оклад в месяц{currency ? `, ${currency}` : " (в валюте компании)"}</Label>
        <Input id="pay-base" {...field("baseSalary")} inputMode="decimal" placeholder="25000" className="h-9 w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pay-percent">Процент с продаж, %</Label>
        <Input id="pay-percent" {...field("commissionPercent")} inputMode="decimal" placeholder="5" className="h-9 w-32" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        Сохранить
      </Button>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "w-full text-sm text-destructive" : "w-full text-sm text-success"}>
          {message.text}
        </p>
      )}
    </form>
  )
}
