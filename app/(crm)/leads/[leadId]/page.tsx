import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { buttonVariants } from "@/components/ui/button"
import { routes } from "@/config/routes"
import { LeadView, LeadViewSkeleton, leadsRepository } from "@/features/leads"
import { tryLoad } from "@/lib/api/load"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Карточка лида" }

type LeadPageProps = PageProps<"/leads/[leadId]">

async function LeadContent({ params }: Pick<LeadPageProps, "params">) {
  const { leadId } = await params
  const [loaded, user] = await Promise.all([tryLoad(() => leadsRepository.getLead(leadId)), getCurrentUser()])
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const lead = loaded.data
  if (!lead) notFound()

  return (
    <>
      <Link
        href={`${routes.sales}?pipeline=${encodeURIComponent(lead.pipeline.id)}`}
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}
      >
        <ArrowLeft data-icon="inline-start" aria-hidden />
        {lead.pipeline.name}
      </Link>
      <LeadView lead={lead} user={user} />
    </>
  )
}

export default function LeadPage({ params }: LeadPageProps) {
  return (
    <div className="space-y-3">
      <Suspense fallback={<LeadViewSkeleton />}>
        <LeadContent params={params} />
      </Suspense>
    </div>
  )
}
