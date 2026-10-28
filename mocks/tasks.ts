/**
 * ДЕМО-ДАННЫЕ задач. Задачи привязаны к демо-лидам из mocks/crm.ts.
 * Группы сроков и просрочку здесь считает mock-слой — в реальном режиме их возвращает backend.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { Task, TaskDueGroup } from "@/features/tasks/schemas"
import { demoDeals } from "@/mocks/crm"
import { DEMO_NOW, DEMO_TODAY, demoAt, demoHeadOfSales, demoManagers, type DemoPerson } from "@/mocks/team"

type Assignee = 0 | 1 | 2 | 3 | 4 | 5 | "rop" | null

type DemoTaskRow = [
  id: string,
  title: string,
  type: Task["type"],
  priority: Task["priority"],
  due: [dayOffset: number, time: string] | null,
  status: Task["status"],
  assignee: Assignee,
  /** Задачу поставил РОП (иначе — сам исполнитель) */
  fromHead: boolean,
  leadId: string | null,
  description: string | null,
  result: string | null,
]

const rows: DemoTaskRow[] = [
  // Айбек Садыков (демо-менеджер)
  ["t-01", "Ответить про рассрочку", "call", "high", [0, "11:30"], "open", 0, false, "lead-f-01", "Клиентка спрашивала, можно ли оплатить частями. Предложить рассрочку на 3 месяца.", null],
  ["t-02", "Выставить счёт на доплату", "email", "high", [1, "10:00"], "open", 0, false, "lead-f-03", null, null],
  ["t-03", "Созвониться после семейного обсуждения", "call", "normal", [1, "12:00"], "open", 0, false, "lead-f-04", "Решение принимает вместе с мужем — подготовить сравнение вариантов по срокам.", null],
  ["t-04", "Назначить следующий шаг по итогам встречи", "todo", "high", [-1, "18:00"], "open", 0, true, "lead-f-10", "Итог встречи не записан. Запишите итог и поставьте задачу или встречу.", null],
  ["t-05", "Согласовать новую дату встречи", "call", "normal", [-1, "18:00"], "open", 0, false, "lead-s-07", null, null],
  ["t-06", "Предложить продление", "call", "normal", [2, "11:00"], "open", 0, false, "lead-s-01", null, null],
  ["t-07", "Повторный звонок по заявке", "call", "normal", [0, "16:30"], "open", 0, false, "lead-n-06", "Два раза не дозвонились. Если не ответит — написать в мессенджер.", null],
  ["t-08", "Подготовить коммерческое предложение", "todo", "normal", [3, "15:00"], "open", 0, true, "lead-s-09", "Клиент пришёл по рекомендации — учесть скидку для рекомендаций.", null],
  ["t-09", "Позвонить в течение 15 минут", "call", "high", [0, "13:10"], "open", 0, false, "lead-n-01", null, null],
  ["t-10", "Отправить материалы после встречи", "email", "normal", [-2, "17:00"], "done", 0, false, "lead-f-04", null, "Отправил презентацию и прайс в мессенджер"],
  ["t-11", "Подтвердить встречу на завтра", "call", "normal", [0, "10:00"], "done", 0, false, "lead-s-09", null, "Клиент подтвердил, придёт к 15:00"],
  ["t-12", "Вернуться к клиенту в декабре", "call", "normal", [35, "10:00"], "open", 0, false, "lead-s-17", null, null],
  // Другие менеджеры
  ["t-13", "Отправить договор юристу клиента", "email", "high", [0, "12:00"], "open", 1, false, "lead-f-02", null, null],
  ["t-14", "Получить остаток оплаты", "call", "high", [3, "10:00"], "open", 1, false, "lead-s-15", null, null],
  ["t-15", "Квалифицировать заявку", "call", "normal", [0, "15:00"], "open", 1, false, "lead-n-04", null, null],
  ["t-16", "Напомнить о себе", "call", "normal", [7, "10:00"], "open", 2, false, "lead-f-06", null, null],
  ["t-17", "Отправить расчёт стоимости", "email", "normal", [0, "12:00"], "open", 2, false, "lead-s-12", null, null],
  ["t-18", "Назначить встречу", "call", "high", [0, "17:00"], "open", 2, false, "lead-n-08", null, null],
  ["t-19", "Отправить реквизиты и QR для оплаты", "email", "high", [-1, "19:00"], "open", 3, true, "lead-f-07", "Клиент дважды спрашивал реквизиты — риск потерять оплату.", null],
  ["t-20", "Выслать примеры работ", "email", "normal", [-2, "12:00"], "open", 3, false, "lead-s-14", null, null],
  ["t-21", "Подтвердить дату старта", "call", "normal", [0, "15:00"], "open", 4, false, "lead-f-08", null, null],
  ["t-22", "Проверить комплект документов", "todo", "normal", [1, "11:00"], "open", 4, false, "lead-c-01", null, null],
  ["t-23", "Написать в мессенджер", "email", "normal", [-1, "11:00"], "open", 4, false, "lead-n-07", null, null],
  ["t-24", "Передать сделку в сопровождение", "todo", "normal", [0, "14:00"], "open", 5, false, "lead-s-16", null, null],
  ["t-25", "Связаться после встречи", "call", "high", [0, "11:00"], "open", 5, true, "lead-f-09", "После встречи не было касаний 5 дней.", null],
  // Без исполнителя и задачи руководителя
  ["t-26", "Обработать заявку с сайта", "call", "high", [0, "13:30"], "open", null, true, "lead-n-03", "Новая заявка без ответственного — возьмите, если свободны.", null],
  ["t-27", "Разобрать с Тимуром план на последнюю неделю", "meeting", "high", [0, "11:00"], "open", "rop", false, null, null, null],
  ["t-28", "Проверить сделки без движения на этапе «Клиент заинтересован»", "todo", "normal", [0, "15:30"], "open", "rop", false, null, null, null],
  ["t-29", "Отправить директору прогноз на конец месяца", "email", "normal", [0, "18:00"], "open", "rop", false, null, null, null],
  ["t-30", "Планёрка отдела продаж", "meeting", "normal", [0, "09:30"], "done", "rop", false, null, null, "Разобрали план недели"],
]

function personFor(assignee: Exclude<Assignee, null>): DemoPerson {
  return assignee === "rop" ? demoHeadOfSales : demoManagers[assignee]
}

const leadNames = new Map(demoDeals.map((deal) => [deal.id, deal.title]))

function dayDiff(isoDate: string): number {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${DEMO_TODAY}T00:00:00Z`)) / 86_400_000)
}

/** Демо-сегодня — вторник: до воскресенья 5 дней, следующая неделя — ещё 7 */
function dueGroupFor(dueAt: string | null, isOverdue: boolean): TaskDueGroup {
  if (!dueAt) return "no_due"
  if (isOverdue) return "overdue"
  const days = dayDiff(dueAt.slice(0, 10))
  if (days <= 0) return "today"
  if (days === 1) return "tomorrow"
  if (days <= 5) return "this_week"
  if (days <= 12) return "next_week"
  return "later"
}

function toTask([id, title, type, priority, due, status, assignee, fromHead, leadId, description, result]: DemoTaskRow): Task {
  const dueAt = due && demoAt(due[0], due[1])
  const isDone = status === "done"
  const isOverdue = !isDone && dueAt !== null && new Date(dueAt) < new Date(DEMO_NOW)
  const assigneePerson = assignee === null ? null : personFor(assignee)
  return {
    id,
    title,
    description,
    type,
    priority,
    status,
    dueAt,
    isOverdue,
    dueGroup: isDone ? null : dueGroupFor(dueAt, isOverdue),
    assignee: assigneePerson,
    createdBy: fromHead || !assigneePerson ? demoHeadOfSales : assigneePerson,
    lead: leadId ? { id: leadId, name: leadNames.get(leadId) ?? leadId } : null,
    completedAt: isDone && dueAt ? dueAt : null,
    result,
  }
}

export const demoTasks: Task[] = rows.map(toTask)

/** Задачи пользователя на демо-сегодня — для виджета «Мой день» */
export function demoTodayTasksFor(userId: string) {
  const mine = demoTasks.filter((task) => task.assignee?.id === userId)
  return {
    date: DEMO_TODAY,
    tasks: mine.filter((task) => task.dueAt?.startsWith(DEMO_TODAY)),
    overdueFromPreviousDays: mine.filter(
      (task) => task.isOverdue && task.dueAt !== null && task.dueAt < demoAt(0, "00:00")
    ).length,
  }
}
