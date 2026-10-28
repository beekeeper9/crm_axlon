"use client"

import { useState } from "react"
import { Menu } from "lucide-react"

import { SectionCatalog } from "@/components/layout/all-sections-menu"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { Role } from "@/lib/permissions/roles"

/** На экранах уже 1024px верхнее меню заменяется списком всех разделов в выезжающей панели. */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Открыть меню" />}
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Разделы</SheetTitle>
          <SheetDescription className="sr-only">Навигация по разделам CRM</SheetDescription>
        </SheetHeader>
        <SectionCatalog role={role} onNavigate={() => setOpen(false)} className="px-2 pb-6" />
      </SheetContent>
    </Sheet>
  )
}
