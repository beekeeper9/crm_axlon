"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { saveLeadRoutingAction } from "@/features/lead-routing/actions"
import type { LeadRouting, RoutingCandidate } from "@/features/lead-routing/api/lead-routing-repository"
import { cn } from "@/lib/utils"

type LeadRoutingFormProps = {
  departmentId: string
  initial: LeadRouting
  /** Директор выбирает отдел, куда идут лиды сотрудников без отдела */
  canChooseIntake: boolean
}

function candidateStatus(candidate: RoutingCandidate): string {
  if (candidate.absent) return "в отсутствии"
  return candidate.onShift ? "на смене" : "не на смене"
}

/** Включение, участники и условия автораспределения лидов одного отдела */
export function LeadRoutingForm({ departmentId, initial, canChooseIntake }: LeadRoutingFormProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.enabled)
  // Пустой список на backend = все активные менеджеры отдела
  const [everyone, setEveryone] = useState(initial.memberIds.length === 0)
  const [memberIds, setMemberIds] = useState<string[]>(initial.memberIds)
  const [requireOnShift, setRequireOnShift] = useState(initial.requireOnShift)
  const [skipOnAbsence, setSkipOnAbsence] = useState(initial.skipOnAbsence)
  const [isCompanyIntake, setIsCompanyIntake] = useState(initial.isCompanyIntake)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  function toggleMember(userId: string) {
    setMemberIds((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]))
    setMessage(null)
  }

  function save() {
    if (!everyone && memberIds.length === 0) {
      setMessage({ tone: "error", text: "Отметьте хотя бы одного менеджера или выберите «Все менеджеры отдела»." })
      return
    }
    startTransition(async () => {
      const error = await saveLeadRoutingAction(departmentId, {
        enabled,
        memberIds: everyone ? [] : memberIds,
        requireOnShift,
        skipOnAbsence,
        ...(canChooseIntake ? { isCompanyIntake } : {}),
      })
      setMessage(error ? { tone: "error", text: error } : { tone: "ok", text: "Сохранено. Правила действуют для новых лидов." })
      if (!error) router.refresh()
    })
  }

  const disabled = isPending || !enabled

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-xl px-4 py-3 ring-1 ring-border">
        <input type="checkbox" className="mt-1 size-4" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); setMessage(null) }} disabled={isPending} />
        <span>
          <span className="block text-sm font-medium">Распределять новые лиды автоматически</span>
          <span className="block text-meta text-muted-foreground">
            Лиды, которые создаёт РОП, директор или импорт, по очереди уходят менеджерам отдела. Лиды, созданные менеджером, остаются у него.
          </span>
        </span>
      </label>

      <fieldset className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-border" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Кто получает лиды</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="members" checked={everyone} onChange={() => setEveryone(true)} />
          Все менеджеры отдела
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="members" checked={!everyone} onChange={() => setEveryone(false)} />
          Только отмеченные
        </label>
        {initial.candidates.length === 0 ? (
          <p className="text-meta text-muted-foreground">В отделе нет активных менеджеров.</p>
        ) : (
          <ul className="divide-y rounded-lg ring-1 ring-border">
            {initial.candidates.map((candidate) => (
              <li key={candidate.userId} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-4"
                  aria-label={`Получает лиды: ${candidate.fullName ?? "менеджер"}`}
                  checked={everyone || memberIds.includes(candidate.userId)}
                  onChange={() => toggleMember(candidate.userId)}
                  disabled={everyone}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{candidate.fullName ?? "Без имени"}</span>
                <span className="text-meta text-muted-foreground">{candidateStatus(candidate)}</span>
                <span className={cn("text-meta", candidate.eligible ? "text-success" : "text-muted-foreground")}>
                  {candidate.eligible ? "получит лид" : "пропускается"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-meta text-muted-foreground">Статус «получит лид» — по сохранённым правилам на момент открытия страницы.</p>
      </fieldset>

      <fieldset className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-border" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Условия</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={requireOnShift} onChange={(event) => setRequireOnShift(event.target.checked)} />
          Только тем, кто на смене (начал рабочий день)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={skipOnAbsence} onChange={(event) => setSkipOnAbsence(event.target.checked)} />
          Пропускать тех, кто в отпуске, на больничном или в отгуле
        </label>
        {canChooseIntake && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={isCompanyIntake} onChange={(event) => setIsCompanyIntake(event.target.checked)} />
            Сюда же — лиды сотрудников без отдела (директор, импорт без отдела)
          </label>
        )}
        <p className="text-meta text-muted-foreground">Если подходящих менеджеров нет, лид остаётся у создателя, а РОП отдела получает уведомление.</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={isPending}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Сохранить
        </Button>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={cn("text-sm", message.tone === "error" ? "text-destructive" : "text-muted-foreground")}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
