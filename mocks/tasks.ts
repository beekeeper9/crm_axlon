/**
 * ДЕМО-ДАННЫЕ задач. Вымышленные компании и сделки.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { TodayTasks } from "@/features/tasks/schemas"

export const demoTodayTasks: TodayTasks = {
  date: "2026-10-27",
  overdueFromPreviousDays: 2,
  tasks: [
    {
      id: "t-1",
      title: "Планёрка отдела продаж",
      type: "meeting",
      dueAt: "2026-10-27T09:30:00+06:00",
      status: "done",
      isOverdue: false,
      priority: "normal",
      relatedTo: null,
    },
    {
      id: "t-2",
      title: "Разобрать с Тимуром план на последнюю неделю",
      type: "call",
      dueAt: "2026-10-27T11:00:00+06:00",
      status: "open",
      isOverdue: true,
      priority: "high",
      relatedTo: null,
    },
    {
      id: "t-3",
      title: "Встреча по комплексному оснащению офиса",
      type: "meeting",
      dueAt: "2026-10-27T14:00:00+06:00",
      status: "open",
      isOverdue: false,
      priority: "high",
      relatedTo: { kind: "deal", name: "ОсОО «Тянь-Шань Сервис»" },
    },
    {
      id: "t-4",
      title: "Проверить сделки без движения на этапе КП",
      type: "todo",
      dueAt: "2026-10-27T15:30:00+06:00",
      status: "open",
      isOverdue: false,
      priority: "normal",
      relatedTo: null,
    },
    {
      id: "t-5",
      title: "Согласовать скидку для клиента",
      type: "call",
      dueAt: "2026-10-27T17:00:00+06:00",
      status: "open",
      isOverdue: false,
      priority: "normal",
      relatedTo: { kind: "deal", name: "ОсОО «Демо Логистик»" },
    },
    {
      id: "t-6",
      title: "Отправить директору прогноз на конец месяца",
      type: "email",
      dueAt: "2026-10-27T18:00:00+06:00",
      status: "open",
      isOverdue: false,
      priority: "normal",
      relatedTo: null,
    },
  ],
}
