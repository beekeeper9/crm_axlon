import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type KpiCardProps = {
  label: string
  value: string
  trend?: React.ReactNode
  /** Пояснение или дополнительная шкала под значением */
  children?: React.ReactNode
}

export function KpiCard({ label, value, trend, children }: KpiCardProps) {
  return (
    <Card className="gap-3 px-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {trend}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </Card>
  )
}

export function KpiCardSkeleton() {
  return (
    <Card className="gap-3 px-4" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-3 w-full" />
    </Card>
  )
}
