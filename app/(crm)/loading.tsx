import { Skeleton } from "@/components/ui/skeleton"

export default function CrmLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Загрузка страницы">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
