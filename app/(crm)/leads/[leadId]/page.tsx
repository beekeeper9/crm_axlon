import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Check, Construction } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { leadsRepository } from "@/features/leads"

const PLANNED_SECTIONS = [
  "Работа: встреча, свойства сделки, задачи, заметки и последние события",
  "Контактные данные и расширяемые поля, настроенные компанией",
  "Оплаты и документы",
  "Звонки и история взаимодействий",
  "Переписка с клиентом",
  "Контекст по лиду, собранный ИИ («Что по сделке?»)",
] as const

type LeadPageProps = PageProps<"/leads/[leadId]">

async function LeadContent({ params }: Pick<LeadPageProps, "params">) {
  const { leadId } = await params
  const lead = await leadsRepository.getLeadSummary(leadId)
  if (!lead) notFound()

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`${lead.stageName} · ${lead.pipelineName} · ответственный ${lead.manager.name}`}
      />
      <Card className="gap-4 px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Construction className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-medium">Полная карточка лида — следующий этап</p>
            <p className="text-sm text-muted-foreground">
              Состав полей зависит от модели данных, которую нужно согласовать с backend.
            </p>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {PLANNED_SECTIONS.map((section) => (
            <li key={section} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {section}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

export default function LeadPage({ params }: LeadPageProps) {
  return (
    <div className="space-y-6">
      <Link href={routes.focus} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft data-icon="inline-start" aria-hidden />
        К фокусу
      </Link>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <LeadContent params={params} />
      </Suspense>
    </div>
  )
}
