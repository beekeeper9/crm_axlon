import { ApiErrorState } from "@/components/shared/api-error-state"
import { DemoNotice } from "@/components/shared/demo-notice"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { fetchReferenceList } from "@/features/reference-lists/api/reference-lists"
import { ReferenceListEditor } from "@/features/reference-lists/components/reference-list-editor"
import { REFERENCE_LIST_META, REFERENCE_LISTS, type ReferenceListKey } from "@/features/reference-lists/lib/lists"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"

/** Справочники компании: директор меняет, РОП видит, чем пользуются менеджеры */
export async function ReferenceListsView({ editable }: { editable: boolean }) {
  return (
    <div className="space-y-8">
      {!editable && <p className="text-sm text-muted-foreground">Только просмотр: справочники меняет директор.</p>}
      {isMockDataSource ? (
        <DemoNotice>Справочники хранятся на сервере компании; в демо-режиме они не загружаются.</DemoNotice>
      ) : (
        REFERENCE_LISTS.map((key) => <ListSection key={key} listKey={key} editable={editable} />)
      )}
    </div>
  )
}

async function ListSection({ listKey, editable }: { listKey: ReferenceListKey; editable: boolean }) {
  const meta = REFERENCE_LIST_META[listKey]
  const result = await tryLoad(async () => fetchReferenceList(await getRenderAuth(), listKey))
  return (
    <section aria-labelledby={`list-${listKey}`} className="space-y-2">
      <div className="space-y-0.5">
        <h2 id={`list-${listKey}`} className="text-base font-semibold">
          {meta.title}
        </h2>
        <p className="text-meta text-muted-foreground">{meta.description}</p>
      </div>
      {result.ok ? <ReferenceListEditor listKey={listKey} items={result.data} editable={editable} /> : <ApiErrorState error={result.error} bare />}
    </section>
  )
}

export function ReferenceListsViewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      {REFERENCE_LISTS.map((key) => (
        <Skeleton key={key} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  )
}
