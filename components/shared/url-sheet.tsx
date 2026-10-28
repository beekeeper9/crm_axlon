"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { Sheet, SheetContent } from "@/components/ui/sheet"

/** Выезжающая панель, открытая параметром адреса (?client=, ?call=): закрытие убирает параметр */
export function UrlSheet({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) startTransition(() => router.replace(closeHref, { scroll: false }))
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">{children}</SheetContent>
    </Sheet>
  )
}
