/**
 * ДЕМО-ДАННЫЕ «Фокуса». Вымышленные лиды; группы, причины и рекомендации ИИ
 * условные — реальные правила отбора определяет backend.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { FocusGroup, FocusItem, FocusList } from "@/features/focus/schemas"
import { demoDeals } from "@/mocks/crm"
import { demoManagers } from "@/mocks/team"

type ManagerIndex = 0 | 1 | 2 | 3 | 4 | 5

type DemoRow = [
  id: string,
  leadName: string,
  stage: string,
  manager: ManagerIndex,
  priority: FocusItem["priority"],
  reason: string,
  since: string | null,
  interaction: [channel: "call" | "chat" | "meeting" | "note", at: string, summary: string] | null,
  next: [title: string, dueAt: string | null] | null,
  ai: string | null,
]

function toItem([id, leadName, stage, manager, priority, reason, since, interaction, next, ai]: DemoRow): FocusItem {
  return {
    id,
    lead: { id: `lead-${id}`, name: leadName },
    pipelineName: "Продажи",
    stageName: stage,
    priority,
    reason: { label: reason, since },
    lastInteraction: interaction && { channel: interaction[0], at: interaction[1], summary: interaction[2] },
    nextAction: next && { title: next[0], dueAt: next[1] },
    aiRecommendation: ai,
    manager: demoManagers[manager],
    amount: demoDeals.find((deal) => deal.id === `lead-${id}`)?.amount ?? null,
    currency: demoDeals.find((deal) => deal.id === `lead-${id}`)?.currency ?? null,
  }
}

const awaiting: DemoRow[] = [
  ["f-01", "Эльнура Мамытова", "Клиент заинтересован", 0, "high", "ждёт ответа", null,
    ["chat", "2026-10-27T10:42:00+06:00", "Спросила, можно ли оплатить частями"],
    ["Ответить про рассрочку", "2026-10-27T11:30:00+06:00"],
    "Клиент готов к покупке, вопрос только в способе оплаты. Предложите рассрочку и зафиксируйте дату первого платежа."],
  ["f-02", "ОсОО «Демо Логистик»", "Встреча состоялась", 1, "high", "ждёт ответа", null,
    ["chat", "2026-10-27T09:15:00+06:00", "Просят договор на согласование юристу"],
    ["Отправить договор", null],
    null],
]

const warm: DemoRow[] = [
  ["f-03", "Азамат Жээнбеков", "Принята предоплата", 0, "high", "тёплый", "2026-09-24",
    ["call", "2026-10-25T16:10:00+06:00", "Внёс предоплату, ждёт счёт на остаток"],
    ["Выставить счёт на доплату", "2026-10-28T10:00:00+06:00"],
    "Оплата остатка задерживается на 3 дня. Напомните о сроке и предложите удобный способ оплаты."],
  ["f-04", "Гульмира Осмонова", "Встреча состоялась", 0, "medium", "тёплый", "2026-10-05",
    ["meeting", "2026-10-21T15:00:00+06:00", "Понравилось предложение, решение принимает вместе с мужем"],
    ["Созвониться после семейного обсуждения", "2026-10-28T12:00:00+06:00"],
    "В разговоре прозвучало возражение по сроку. Подготовьте сравнение вариантов по срокам."],
  ["f-05", "Руслан Иманов", "Клиент заинтересован", 0, "medium", "тёплый", "2026-10-13",
    ["call", "2026-10-24T11:20:00+06:00", "Просил перезвонить после зарплаты"],
    null,
    null],
  ["f-06", "Айпери Касымова", "Отложенный интерес", 2, "low", "тёплый", "2026-10-08",
    ["chat", "2026-10-19T18:05:00+06:00", "Вернётся к вопросу в ноябре"],
    ["Напомнить о себе", "2026-11-03T10:00:00+06:00"],
    null],
  ["f-07", "Тилек Бообеков", "Встреча состоялась", 3, "high", "тёплый", "2026-10-20",
    ["meeting", "2026-10-26T14:30:00+06:00", "Готов оплатить, ждёт реквизиты"],
    ["Отправить реквизиты и QR", null],
    "Клиент дважды спрашивал реквизиты. Отправьте их сегодня — риск потерять оплату."],
  ["f-08", "Жанара Абдыраева", "Принята предоплата", 4, "medium", "тёплый", "2026-10-10",
    ["call", "2026-10-22T10:40:00+06:00", "Уточняла сроки начала"],
    ["Подтвердить дату старта", "2026-10-27T15:00:00+06:00"],
    null],
  ["f-09", "Эмир Султанов", "Клиент заинтересован", 5, "medium", "тёплый", "2026-10-22",
    null,
    null,
    "После встречи не было ни одного касания 5 дней. Свяжитесь, пока интерес не остыл."],
]

const noNextStep: DemoRow[] = [
  ["f-10", "Нурзат Алиева", "Встреча состоялась", 0, "medium", "нет следующего шага", null,
    ["meeting", "2026-10-26T12:00:00+06:00", "Итог встречи не записан"],
    null,
    null],
  ["f-11", "Самат Абдраимов", "Встреча состоялась", 4, "low", "нет следующего шага", null,
    ["call", "2026-10-23T17:45:00+06:00", "Обещал подумать"],
    null,
    null],
]

const groups: FocusGroup[] = [
  { id: "awaiting", title: "Клиент ждёт", description: "Клиент написал и ждёт ответа — отвечайте в первую очередь", tone: "urgent", items: awaiting.map(toItem) },
  { id: "warm", title: "Тёплые — дожать", description: "Отмечены после встречи; если дожали или остыли — снимите метку в карточке", tone: "warm", items: warm.map(toItem) },
  { id: "no-next-step", title: "Без следующего шага", description: "Назначьте задачу или встречу, чтобы лид не потерялся", tone: "neutral", items: noNextStep.map(toItem) },
]

const allItems = groups.flatMap((group) => group.items)

export const demoFocusList: FocusList = {
  awaitingReply: awaiting.length,
  managers: demoManagers.map((manager) => ({
    ...manager,
    count: allItems.filter((item) => item.manager.id === manager.id).length,
  })),
  groups,
}

/** Демо-фильтр по менеджеру; в реальном API фильтрует backend */
export function filterDemoFocusList(managerId: string | null): FocusList {
  if (!managerId) return demoFocusList
  const groupsForManager = demoFocusList.groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.manager.id === managerId),
  }))
  return {
    ...demoFocusList,
    awaitingReply: groupsForManager.find((group) => group.id === "awaiting")?.items.length ?? 0,
    groups: groupsForManager,
  }
}
