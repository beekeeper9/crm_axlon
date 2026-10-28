import Link from "next/link"
import { SearchX } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { routes } from "@/config/routes"

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={SearchX}
        title="Страница не найдена"
        description="Возможно, ссылка устарела или страница была перемещена."
        action={
          <Link href={routes.myDay} className={buttonVariants({ variant: "outline", size: "sm" })}>
            В «Мой день»
          </Link>
        }
      />
    </main>
  )
}
