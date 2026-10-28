"use client"

import { useState } from "react"
import { ListChecks, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { ListGroup, ListPanel } from "@/components/shared/list-panel"
import { Button } from "@/components/ui/button"
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet"
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog"
import { TaskRow } from "@/features/tasks/components/task-row"
import { DUE_GROUPS } from "@/features/tasks/lib/task-meta"
import type { Task, TaskFormValues } from "@/features/tasks/schemas"
import { companyWallTimeToIso } from "@/lib/datetime"
import { formatNumber, pluralize } from "@/lib/format"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type Person = { id: string; name: string }

type TasksListProps = {
  initialTasks: readonly Task[]
  members: readonly Person[]
  currentUser: Person
  canAssign: boolean
  editMode: EditMode
  showAssignee: boolean
  /** В карточке лида ссылка на лид не нужна, а новая задача сразу к нему привязана */
  lead: Person | null
  emptyTitle: string
  emptyDescription: string
  /** Заголовок над списком (в карточке лида); без него — количество задач */
  heading?: string
}

type Group = { id: string; label: string; tasks: Task[] }

/**
 * Группы сроков приходят от backend (dueGroup). Задачи, изменённые в демо-режиме,
 * собраны отдельно: их срок и просрочку мог бы пересчитать только сервер.
 */
function groupTasks(tasks: readonly Task[], changedIds: ReadonlySet<string>): Group[] {
  const groups: Group[] = []
  const changed = tasks.filter((task) => changedIds.has(task.id))
  if (changed.length > 0) groups.push({ id: "demo", label: "Изменено в демо-режиме", tasks: changed })

  const rest = tasks.filter((task) => !changedIds.has(task.id))
  for (const group of DUE_GROUPS) {
    const items = rest.filter((task) => task.status === "open" && task.dueGroup === group.id)
    if (items.length > 0) groups.push({ id: group.id, label: group.label, tasks: items })
  }
  const done = rest.filter((task) => task.status === "done")
  if (done.length > 0) groups.push({ id: "done", label: "Выполнено", tasks: done })
  return groups
}

export function TasksList({
  initialTasks,
  members,
  currentUser,
  canAssign,
  editMode,
  showAssignee,
  lead,
  emptyTitle,
  emptyDescription,
  heading,
}: TasksListProps) {
  const [tasks, setTasks] = useState<readonly Task[]>(initialTasks)
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set())
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })

  const canEdit = editMode === "demo"
  const openTask = tasks.find((task) => task.id === openTaskId) ?? null
  const groups = groupTasks(tasks, changedIds)

  function update(taskId: string, patch: Partial<Task>) {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, ...patch } : task)))
    setChangedIds((current) => new Set(current).add(taskId))
  }

  function personById(id: string | null): Person | null {
    if (!id) return null
    return members.find((member) => member.id === id) ?? (id === currentUser.id ? currentUser : null)
  }

  function save(values: TaskFormValues) {
    const fields = {
      title: values.title,
      type: values.type,
      priority: values.priority,
      description: values.description || null,
      dueAt: companyWallTimeToIso(values.dueAt),
      assignee: canAssign ? personById(values.assigneeId) : currentUser,
    }
    if (form.task) {
      update(form.task.id, fields)
    } else {
      const id = `demo-${crypto.randomUUID()}`
      const created: Task = {
        ...fields,
        id,
        status: "open",
        // Без backend срок не с чем сравнить — просрочку и группу не выдумываем
        isOverdue: false,
        dueGroup: null,
        createdBy: currentUser,
        lead,
        completedAt: null,
        result: null,
      }
      setTasks((current) => [created, ...current])
      setChangedIds((current) => new Set(current).add(id))
    }
    setForm({ open: false, task: null })
  }

  function complete(task: Task, result: string) {
    update(task.id, {
      status: "done",
      isOverdue: false,
      dueGroup: null,
      completedAt: new Date().toISOString(),
      result: result || null,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {heading ? (
          <h2 className="text-sm font-semibold">{heading}</h2>
        ) : (
          <p className="text-meta text-muted-foreground">
            {tasks.length > 0 ? `${formatNumber(tasks.length)} ${pluralize(tasks.length, ["задача", "задачи", "задач"])}` : null}
          </p>
        )}
        {editMode !== "read-only" && (
          <Button
            size="sm"
            onClick={() => setForm({ open: true, task: null })}
            disabled={!canEdit}
            title={canEdit ? undefined : EDIT_UNAVAILABLE_HINT}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Новая задача
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <ListPanel>
          <EmptyState icon={ListChecks} title={emptyTitle} description={emptyDescription} />
        </ListPanel>
      ) : (
        <ListPanel>
          {groups.map((group) => (
            <ListGroup
              key={group.id}
              id={`tasks-${group.id}`}
              title={group.label}
              count={group.tasks.length}
              tone={group.id === "overdue" ? "danger" : group.id === "demo" ? "warning" : "default"}
            >
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showAssignee={showAssignee}
                  showLead={lead === null}
                  isDemoChanged={changedIds.has(task.id)}
                  canComplete={canEdit}
                  onOpen={(item) => setOpenTaskId(item.id)}
                  onComplete={(item) => complete(item, "")}
                />
              ))}
            </ListGroup>
          ))}
        </ListPanel>
      )}

      <TaskDetailSheet
        task={openTask}
        editMode={editMode}
        isDemoChanged={openTask ? changedIds.has(openTask.id) : false}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
        onComplete={complete}
        onEdit={(task) => {
          setOpenTaskId(null)
          setForm({ open: true, task })
        }}
        onTake={(task) => update(task.id, { assignee: currentUser })}
      />
      <TaskFormDialog
        open={form.open}
        task={form.task}
        leadName={form.task?.lead?.name ?? lead?.name ?? null}
        members={members}
        canAssign={canAssign}
        currentUser={currentUser}
        onOpenChange={(open) => !open && setForm({ open: false, task: null })}
        onSave={save}
      />
    </div>
  )
}
