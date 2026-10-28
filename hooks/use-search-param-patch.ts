"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { applyParamPatch, type ParamPatch } from "@/lib/search-params"

/** Меняет параметры адреса без перезагрузки и прокрутки; isPending — пока сервер отдаёт новые данные */
export function useSearchParamPatch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function patchParams(patch: ParamPatch) {
    const query = applyParamPatch(new URLSearchParams(searchParams), patch).toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return { patchParams, isPending, searchParams }
}
