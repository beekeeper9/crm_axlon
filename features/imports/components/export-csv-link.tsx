"use client"

import { Download } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"

/** Фильтры списка, которые учитывает выгрузка; страница и открытая карточка — нет */
const EXPORTED_PARAMS = ["q", "status", "source", "owner", "manager"] as const

type ExportCsvLinkProps = {
  /** Обработчик выгрузки, например /exports/customers */
  href: string
}

/** «Скачать CSV» с текущими фильтрами списка. Файл собирает сервер интерфейса из ответов backend */
export function ExportCsvLink({ href }: ExportCsvLinkProps) {
  const params = useSearchParams()
  const query = new URLSearchParams()
  for (const key of EXPORTED_PARAMS) {
    const value = params.get(key)
    if (value) query.set(key, value)
  }
  const target = query.size > 0 ? `${href}?${query.toString()}` : href
  return (
    <a href={target} download className={buttonVariants({ variant: "outline", size: "sm" })}>
      <Download data-icon="inline-start" aria-hidden />
      Скачать CSV
    </a>
  )
}
