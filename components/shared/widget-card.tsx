import { cn } from "@/lib/utils"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type WidgetCardProps = {
  title: string
  description?: string
  /** Элемент справа в заголовке: ссылка, счётчик, переключатель */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

/** Единая рамка виджета: одинаковые отступы, заголовок и поведение по высоте. */
export function WidgetCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: WidgetCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

type WidgetSkeletonProps = {
  title: string
  /** Высота области содержимого, чтобы страница не «прыгала» после загрузки */
  bodyClassName?: string
}

export function WidgetSkeleton({ title, bodyClassName = "h-48" }: WidgetSkeletonProps) {
  return (
    <WidgetCard title={title}>
      <div aria-busy="true" aria-label={`${title}: загрузка`}>
        <Skeleton className={cn("w-full", bodyClassName)} />
      </div>
    </WidgetCard>
  )
}
