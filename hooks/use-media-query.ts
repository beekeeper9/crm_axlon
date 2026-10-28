"use client"

import { useSyncExternalStore } from "react"

/** Совпадает ли медиазапрос; на сервере — false (первый рендер без панели) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", onChange)
      return () => media.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
