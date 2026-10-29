"use client"

import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Печать страницы или сохранение в PDF через системный диалог браузера */
export function PrintButton({ label = "Печать / PDF" }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  )
}
