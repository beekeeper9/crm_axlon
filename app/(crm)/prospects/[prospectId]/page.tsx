import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { buttonVariants } from "@/components/ui/button"
import { routes } from "@/config/routes"
import { ProspectView, ProspectViewSkeleton, prospectsRepository } from "@/features/prospects"
import { tryLoad } from "@/lib/api/load"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Входящий лид" }

type ProspectPageProps = PageProps<"/prospects/[prospectId]">

async function ProspectContent({ params }: Pick<ProspectPageProps, "params">) {
  const { prospectId } = await params
  const [loaded, user] = await Promise.all([tryLoad(() => prospectsRepository.getProspect(prospectId)), getCurrentUser()])
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  if (!loaded.data) notFound()
  return <ProspectView prospect={loaded.data} user={user} />
}

export default function ProspectPage({ params }: ProspectPageProps) {
  return (
    <div className="space-y-3">
      <Link href={routes.prospects} className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}>
        <ArrowLeft data-icon="inline-start" aria-hidden />
        Входящие лиды
      </Link>
      <Suspense fallback={<ProspectViewSkeleton />}>
        <ProspectContent params={params} />
      </Suspense>
    </div>
  )
}
