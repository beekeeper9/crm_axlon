import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { getFunnelWithCounts, listFunnels } from "@/features/sales/funnel/funnel-api"
import { FunnelEditor } from "@/features/sales/funnel/funnel-editor"
import { FUNNEL_SETTINGS_PATH } from "@/features/sales/funnel/funnel-settings-view"
import { CabinetSection } from "@/features/team-cabinet/components/cabinet-parts"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Этапы воронки отдела прямо во вкладке «Воронка»: тот же редактор, что в настройке воронки.
 * РОП меняет воронку своего отдела (права проверяет backend); новые воронки и перенос
 * сделок — на полной странице настройки.
 */
export async function FunnelStagesSection({ pipelineId, isDirector }: { pipelineId: string | null; isDirector: boolean }) {
  const loaded = await tryLoad(async () => {
    const auth = await getRenderAuth()
    const funnels = await listFunnels(auth)
    // РОП меняет только воронки своего отдела; общие воронки компании — директор
    const editable = isDirector ? funnels : funnels.filter((funnel) => funnel.departmentId !== null)
    const selected = editable.find((funnel) => funnel.id === pipelineId) ?? editable.find((funnel) => funnel.isDefault) ?? editable[0]
    return selected ? getFunnelWithCounts(auth, selected.id) : null
  })
  const settings = (
    <Link href={FUNNEL_SETTINGS_PATH} className="text-sm text-primary hover:underline">
      Все настройки воронки
    </Link>
  )
  return (
    <CabinetSection
      id="team-funnel-stages"
      title={loaded.ok && loaded.data ? `Этапы воронки · ${loaded.data.name}` : "Этапы воронки"}
      description="Изменения сразу видят менеджеры отдела на «Продажах»."
      action={settings}
    >
      {!loaded.ok ? (
        <ApiErrorState error={loaded.error} bare />
      ) : loaded.data ? (
        <FunnelEditor key={loaded.data.id} funnel={loaded.data} />
      ) : (
        <p className="text-sm text-muted-foreground">
          У отдела пока нет своей воронки — менеджеры работают в общей воронке компании.{" "}
          <Link href={`${FUNNEL_SETTINGS_PATH}?new=1`} className="text-primary hover:underline">
            Создать воронку отдела
          </Link>
        </p>
      )}
    </CabinetSection>
  )
}
