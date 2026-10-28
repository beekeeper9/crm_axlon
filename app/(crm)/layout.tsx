import { Suspense } from "react"

import { AppHeader, AppHeaderSkeleton } from "@/components/layout/app-header"

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Пользователь определяется на каждый запрос, поэтому шапка подгружается отдельно */}
      <Suspense fallback={<AppHeaderSkeleton />}>
        <AppHeader />
      </Suspense>
      <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
      </main>
    </div>
  )
}
