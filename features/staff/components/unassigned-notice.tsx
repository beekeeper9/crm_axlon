"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { assignDepartmentAction } from "@/features/staff/actions"
import { formatNumber, pluralize } from "@/lib/format"

type Unassigned = { id: string; fullName: string; roleLabel: string }

/**
 * Действующие сотрудники без отдела — нарушение правила «у каждого сотрудника есть отдел»
 * (старые записи). Автоматически их не меняем: директор сам выбирает отдел каждому.
 */
export function UnassignedNotice({ members, departments }: { members: readonly Unassigned[]; departments: readonly { id: string; name: string }[] }) {
  return (
    <section role="status" className="space-y-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          <strong className="font-semibold">
            {formatNumber(members.length)} {pluralize(members.length, ["действующий сотрудник", "действующих сотрудника", "действующих сотрудников"])} без отдела
          </strong>{" "}
          — назначьте отдел. В системе у каждого сотрудника, кроме директора, должен быть отдел.
        </span>
      </p>
      <ul className="space-y-2">
        {members.map((member) => (
          <AssignRow key={member.id} member={member} departments={departments} />
        ))}
      </ul>
    </section>
  )
}

function AssignRow({ member, departments }: { member: Unassigned; departments: readonly { id: string; name: string }[] }) {
  const router = useRouter()
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-40 font-medium">
        {member.fullName} <span className="font-normal text-muted-foreground">· {member.roleLabel}</span>
      </span>
      <Select items={departments.map((d) => ({ value: d.id, label: d.name }))} value={departmentId} onValueChange={setDepartmentId}>
        <SelectTrigger className="h-8 w-56" aria-label={`Отдел для ${member.fullName}`}>
          <SelectValue placeholder="Выберите отдел" />
        </SelectTrigger>
        <SelectContent>
          {departments.map((department) => (
            <SelectItem key={department.id} value={department.id}>
              {department.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={!departmentId || isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await assignDepartmentAction(member.id, departmentId ?? "")
            setFailure(result.ok ? null : result.message)
            if (result.ok) router.refresh()
          })
        }
      >
        {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        Назначить
      </Button>
      {failure && (
        <span role="alert" className="text-destructive">
          {failure}
        </span>
      )}
    </li>
  )
}
