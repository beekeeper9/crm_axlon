"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Building2, LoaderCircle } from "lucide-react"

import { CredentialsCard } from "@/components/shared/credentials-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { platformCompanyRoute, routes } from "@/config/routes"
import { createCompanyAction, type ActionResult } from "@/features/platform/actions"
import { DirectorCredentialsButton } from "@/features/platform/components/director-credentials-button"
import { ActionError, ChoiceSelect, defaultFeatures, FeatureChecklist, FormField, planOptions } from "@/features/platform/components/platform-controls"
import { FEATURE_LABELS, PLAN_LABELS } from "@/features/platform/labels"
import type { Catalog, CreatedCompany, Feature, PlanCode } from "@/features/platform/schemas"
import { formatFullDate } from "@/lib/format"

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu",
  я: "ya", ң: "n", ө: "o", ү: "u",
}

/** Подсказка короткого имени из названия: «ОсОО „Альфа Трейд“» → «alfa-treyd» */
function suggestSlug(name: string): string {
  const latin = [...name.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("")
  const words = latin.replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((word) => !["osoo", "ooo", "ip", "llc", "too"].includes(word))
  return words.join("-").slice(0, 40).replace(/-+$/, "")
}

type Created = Extract<ActionResult<CreatedCompany>, { ok: true }>["data"]

export function CompanyCreateForm({ catalog, today }: { catalog: Catalog; today: string }) {
  const [created, setCreated] = useState<Created | null>(null)
  if (created) {
    const sub = created.company.subscription
    return (
      <CredentialsCard
        title="Компания подключена"
        description="Передайте директору данные для входа. Пароль показывается только сейчас."
        login={created.director.login}
        temporaryPassword={created.director.temporaryPassword}
        rows={[
          { label: "Компания", value: `${created.company.name} (${created.company.slug})` },
          { label: "Директор", value: created.company.directors[0]?.fullName ?? created.director.login },
          { label: "Тариф", value: sub ? `${PLAN_LABELS[sub.planCode]}, ${sub.endsOn ? `до ${formatFullDate(sub.endsOn)}` : "бессрочно"}` : "—" },
          { label: "Модули", value: sub?.features?.length ? sub.features.map((f) => FEATURE_LABELS[f]).join(", ") : "Только основа CRM" },
        ]}
        actions={
          <>
            {created.company.directors[0] && (
              <DirectorCredentialsButton
                companyId={created.company.id}
                companyName={created.company.name}
                director={created.company.directors[0]}
                label="Сгенерировать пароль заново"
              />
            )}
            <Link href={platformCompanyRoute(created.company.id)} className={buttonVariants({ variant: "outline", size: "lg" })}>
              Открыть карточку компании
            </Link>
          </>
        }
      />
    )
  }
  return <CreateForm catalog={catalog} today={today} onCreated={setCreated} />
}

function CreateForm({ catalog, today, onCreated }: { catalog: Catalog; today: string; onCreated: (created: Created) => void }) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [country, setCountry] = useState("KG")
  const [currency, setCurrency] = useState("KGS")
  const [timezone, setTimezone] = useState("Asia/Bishkek")
  const [planCode, setPlanCode] = useState<PlanCode>("pro")
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState("")
  const [features, setFeatures] = useState<Feature[]>(defaultFeatures(catalog, "pro"))
  const [director, setDirector] = useState({ firstName: "", lastName: "", login: "", email: "", phone: "" })
  const [failure, setFailure] = useState<Extract<ActionResult, { ok: false }> | null>(null)
  const errors = failure?.fieldErrors ?? {}

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createCompanyAction({
        name,
        slug,
        country,
        currency,
        timezone,
        subscription: { planCode, startsOn, endsOn, features, status: "active" },
        director,
      })
      if (result.ok) onCreated(result.data)
      else setFailure(result)
    })
  }

  const directorField = (key: keyof typeof director) => ({
    value: director[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDirector((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Section title="Компания">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Название" error={errors.name}>
            <Input
              id="name"
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value)
                if (!slugTouched) setSlug(suggestSlug(event.target.value))
              }}
              placeholder="ОсОО «Альфа Трейд»"
              className="h-10"
              aria-invalid={Boolean(errors.name)}
            />
          </FormField>
          <FormField id="slug" label="Короткое имя" error={errors.slug} hint="Латиница, цифры и дефис. Изменить потом нельзя">
            <Input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value.toLowerCase())
              }}
              placeholder="alfa-treyd"
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 font-mono"
              aria-invalid={Boolean(errors.slug)}
            />
          </FormField>
          <FormField id="country" label="Страна" error={errors.country} hint="Код ISO, например KG">
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className="h-10" />
          </FormField>
          <FormField id="currency" label="Валюта сделок" error={errors.currency} hint="Код ISO, например KGS">
            <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="h-10" />
          </FormField>
          <FormField id="timezone" label="Часовой пояс" error={errors.timezone} hint="Для отчётов по дням">
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-10" />
          </FormField>
        </div>
      </Section>

      <Section title="Подписка" note="Назначение тарифа не означает, что оплата получена.">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="planCode" label="Тариф">
            <ChoiceSelect
              id="planCode"
              value={planCode}
              options={planOptions(catalog)}
              onChange={(next) => {
                setPlanCode(next)
                setFeatures(defaultFeatures(catalog, next))
              }}
            />
          </FormField>
          <FormField id="startsOn" label="Начало" error={errors["subscription.startsOn"]}>
            <Input id="startsOn" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="h-10" />
          </FormField>
          <FormField id="endsOn" label="Последний день доступа" error={errors["subscription.endsOn"]} hint="Пусто — бессрочно">
            <Input id="endsOn" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="h-10" />
          </FormField>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Модули</p>
          <FeatureChecklist value={features} onChange={setFeatures} />
        </div>
      </Section>

      <Section title="Директор компании" note="Временный пароль сгенерирует сервер и покажет один раз.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="firstName" label="Имя" error={errors["director.firstName"]}>
            <Input id="firstName" {...directorField("firstName")} className="h-10" aria-invalid={Boolean(errors["director.firstName"])} />
          </FormField>
          <FormField id="lastName" label="Фамилия">
            <Input id="lastName" {...directorField("lastName")} className="h-10" />
          </FormField>
          <FormField id="login" label="Логин (необязательно)" error={errors["director.login"]} hint="Если пусто, система придумает логин сама">
            <Input id="login" {...directorField("login")} autoCapitalize="none" spellCheck={false} className="h-10" />
          </FormField>
          <FormField id="email" label="E-mail (необязательно)" error={errors["director.email"]}>
            <Input id="email" type="email" {...directorField("email")} className="h-10" />
          </FormField>
          <FormField id="phone" label="Телефон (необязательно)">
            <Input id="phone" type="tel" {...directorField("phone")} maxLength={16} className="h-10" />
          </FormField>
        </div>
      </Section>

      <ActionError failure={failure} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Building2 data-icon="inline-start" aria-hidden />}
          {isPending ? "Создаём компанию и её базу…" : "Подключить компанию"}
        </Button>
        <Link href={routes.platformCompanies} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Отмена
        </Link>
      </div>
    </form>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-border">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="text-meta text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  )
}
