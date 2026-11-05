"use client"

import { useState } from "react"
import { ListChecks, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { ListGroup, ListPanel } from "@/components/shared/list-panel"
import { Button } from "@/components/ui/button"
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet"
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog"
import { TaskRow } from "@/features/tasks/components/task-row"
import { changeTaskStateAction, completeTaskAction, createDealTaskAction, createTaskAction, updateTaskAction, type TaskActionResult } from "@/features/tasks/actions"
import type { TaskSubjectOption } from "@/features/tasks/api/tasks-repository"
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
  /**
   * id сделки, если создание и выполнение задач идут через backend (режим api, карточка сделки).
   * null — демо-поведение: изменения живут только на странице
   */
  remoteDealId?: string | null
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
  remoteDealId = null,
}: TasksListProps) {
  const [tasks, setTasks] = useState<readonly Task[]>(initialTasks)
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set())
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })

  const canEdit = editMode === "demo"
  // Через backend работают создание (только в карточке сделки) и выполнение; права окончательно проверяет он
  const isRemote = !canEdit && editMode !== "read-only"
  // Вне карточки сделки задача тоже создаётся через backend: сделку или клиента выбирают в форме
  const canCreate = canEdit || isRemote
  const canWrite = canEdit || isRemote
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set())
  const [listError, setListError] = useState<{ message: string; requestId: string | null } | null>(null)
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

  /** Ответ backend заменяет задачу целиком: статус, группа срока и просрочка — его */
  function applyServerTask(result: TaskActionResult): string | null {
    if (!result.ok) return result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message
    const task = { ...result.task, lead: result.task.lead ?? lead }
    setTasks((current) => (current.some((item) => item.id === task.id) ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current]))
    return null
  }

  async function saveRemote(dealId: string | null, values: TaskFormValues, subject: TaskSubjectOption | null): Promise<string | null> {
    const editing = form.task
    const fields = {
      title: values.title,
      dueDate: values.dueAt,
      type: values.type === "email" ? ("todo" as const) : values.type,
      priority: values.priority,
      assigneeId: canAssign ? values.assigneeId : null,
      description: values.description,
    }
    if (!editing && !dealId) {
      // Сделка или клиент — по желанию: без них задача просто ставится исполнителю
      const error = applyServerTask(await createTaskAction(subject, fields))
      if (!error) setForm({ open: false, task: null })
      return error
    }
    const error = applyServerTask(
      editing
        ? await updateTaskAction(
            editing.id,
            {
              title: values.title,
              dueDate: values.dueAt,
              priority: values.priority,
              assigneeId: canAssign ? values.assigneeId : null,
              description: values.description,
            },
            editing.assignee?.id ?? null
          )
        : await createDealTaskAction(dealId ?? "", fields)
    )
    if (!error) setForm({ open: false, task: null })
    return error
  }

  async function completeRemote(task: Task, result: string): Promise<string | null> {
    if (busyIds.has(task.id)) return null
    setBusyIds((current) => new Set(current).add(task.id))
    setListError(null)
    try {
      return applyServerTask(await completeTaskAction(task.id, result))
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
    }
  }

  function save(values: TaskFormValues, subject: TaskSubjectOption | null) {
    if (isRemote) return saveRemote(remoteDealId, values, subject)
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
    if (isRemote) return completeRemote(task, result)
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
            onClick={() => {
              setListError(null)
              setForm({ open: true, task: null })
            }}
            disabled={!canCreate}
            title={canCreate ? undefined : EDIT_UNAVAILABLE_HINT}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Новая задача
          </Button>
        )}
      </div>

      {listError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {listError.message}
        </p>
      )}

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
                  canComplete={canWrite && !busyIds.has(task.id)}
                  onOpen={(item) => setOpenTaskId(item.id)}
                  onComplete={(item) => {
                    const completing = complete(item, "")
                    if (completing) void completing.then((message) => message && setListError({ message, requestId: null }))
                  }}
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
        canComplete={canWrite && !(openTask && busyIds.has(openTask.id))}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
        onComplete={complete}
        onEdit={(task) => {
          setOpenTaskId(null)
          setForm({ open: true, task })
        }}
        onTake={(task) => update(task.id, { assignee: currentUser })}
        onChangeState={
          isRemote
            ? async (task, action) => {
                const result = await changeTaskStateAction(task.id, action)
                // Отменённая задача уходит из списка: в интерфейсе нет такого статуса
                if (result.ok && action === "cancel") {
                  setTasks((current) => current.filter((item) => item.id !== task.id))
                  setOpenTaskId(null)
                  return null
                }
                return applyServerTask(result)
              }
            : undefined
        }
      />
      <TaskFormDialog
        open={form.open}
        task={form.task}
        leadName={form.task?.lead?.name ?? lead?.name ?? null}
        members={members}
        canAssign={canAssign}
        currentUser={currentUser}
        onOpenChange={(open) => !open && setForm({ open: false, task: null })}
        mode={isRemote ? "server" : "demo"}
        onSave={save}
        needsSubject={isRemote && remoteDealId === null && form.task === null}
      />
    </div>
  )
}
