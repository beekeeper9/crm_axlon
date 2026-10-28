/**
 * ДЕМО-ДАННЫЕ карточки лида: история, звонки, оплаты и контекст ИИ.
 * Строятся из демо-сделок (mocks/crm.ts); у нескольких лидов история подробнее.
 * Тексты ИИ и транскрипции — вымышленные примеры, не результат работы модели.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { LeadActivity, LeadCall, LeadDetail } from "@/features/leads/schemas"
import { addDecimals, subtractDecimal } from "@/lib/decimal"
import { demoDeals, demoSalesConfig } from "@/mocks/crm"
import { demoAt, demoManagers } from "@/mocks/team"

type Extra = {
  email?: string
  city?: string
  source?: string
  fields?: [label: string, value: string | null][]
  ai?: { summary: string; nextSteps: string[] }
  payment?: { total: string; items: [kind: "prepayment" | "additional" | "full", amount: string, dayOffset: number][] }
  activity?: [kind: LeadActivity["kind"], dayOffset: number, time: string, title: string, body: string | null][]
  calls?: Omit<LeadCall, "id" | "manager">[]
}

const extras: Record<string, Extra> = {
  "lead-f-01": {
    city: "Бишкек",
    source: "Instagram",
    fields: [["Интерес", "Пакет «Стандарт»"], ["Удобный способ связи", "Мессенджер"], ["Решение принимает", "Сама"]],
    ai: {
      summary:
        "Клиентка была на встрече 24 октября, вариант понравился. Готова купить, единственный открытый вопрос — оплата частями. Возражений по цене не было.",
      nextSteps: ["Ответить про рассрочку сегодня", "Предложить график платежей и зафиксировать дату первого платежа", "После согласия — перевести на этап «Принята предоплата»"],
    },
    activity: [
      ["chat", 0, "10:42", "Сообщение от клиента", "Добрый день! А можно оплатить частями?"],
      ["call", -2, "16:05", "Исходящий звонок · 4:12", "Обсудили варианты пакета, клиентка думает про сроки оплаты"],
      ["stage", -3, "10:00", "Этап: Клиент заинтересован", null],
      ["meeting", -3, "15:00", "Встреча состоялась", "Понравился пакет «Стандарт», попросила подумать до выходных"],
      ["note", -3, "15:40", "Заметка", "Сравнивала с другой компанией, у нас понравился сервис"],
      ["meeting", -6, "12:00", "Встреча назначена на 24 окт., 15:00", null],
    ],
    calls: [
      {
        at: demoAt(-2, "16:05"),
        direction: "outgoing",
        durationSec: 252,
        summary: "Клиентка готова к покупке, уточняла, можно ли разбить оплату на 2–3 платежа. Договорились вернуться с ответом.",
        transcript: [
          { speaker: "manager", text: "Эльнура, добрый день! Удобно говорить? Хотел узнать, как вам наше предложение после встречи." },
          { speaker: "client", text: "Да, здравствуйте. В целом всё нравится, но сразу всю сумму сложно." },
          { speaker: "manager", text: "Понимаю. Давайте я уточню варианты оплаты частями и вернусь к вам с графиком." },
          { speaker: "client", text: "Хорошо, буду ждать. Лучше в мессенджер." },
        ],
        rating: { score: 4, comment: "Хорошо выявил потребность. Не назначил точное время следующего контакта." },
      },
      {
        at: demoAt(-7, "11:20"),
        direction: "incoming",
        durationSec: 95,
        summary: "Входящий звонок по рекламе. Записана на встречу.",
        transcript: null,
        rating: { score: 5, comment: null },
      },
    ],
  },
  "lead-f-03": {
    city: "Бишкек",
    source: "Рекомендация",
    fields: [["Интерес", "Пакет «Расширенный»"], ["Удобный способ связи", "Звонок"], ["Решение принимает", "Сам"]],
    ai: {
      summary: "Предоплата получена 22 октября. Остаток по договорённости — до 30 октября, клиент ждёт счёт.",
      nextSteps: ["Выставить счёт на остаток", "Напомнить о сроке оплаты за день до него"],
    },
    payment: { total: "320000.00", items: [["prepayment", "160000.00", -5]] },
    activity: [
      ["call", -2, "16:10", "Исходящий звонок · 2:40", "Внёс предоплату, ждёт счёт на остаток"],
      ["payment", -5, "12:30", "Предоплата 160 000 сом", null],
      ["stage", -5, "12:31", "Этап: Принята предоплата", null],
      ["meeting", -8, "14:00", "Встреча состоялась", "Выбрал расширенный пакет"],
    ],
    calls: [
      {
        at: demoAt(-2, "16:10"),
        direction: "outgoing",
        durationSec: 160,
        summary: "Подтвердил получение предоплаты, попросил прислать счёт на остаток на почту.",
        transcript: null,
        rating: { score: 3, comment: "Не уточнил дату оплаты остатка." },
      },
    ],
  },
  "lead-f-04": {
    city: "Кант",
    source: "Сайт",
    fields: [["Интерес", "Пакет «Семейный»"], ["Решение принимает", "Вместе с мужем"]],
    ai: {
      summary: "После встречи решение откладывается: клиентка советуется с мужем. Возражение по сроку — хочет короче.",
      nextSteps: ["Подготовить сравнение вариантов по срокам", "Позвонить после семейного обсуждения и пригласить обоих на короткую встречу"],
    },
    activity: [
      ["meeting", -6, "15:00", "Встреча состоялась", "Пришла с мужем, интересует срок 6 месяцев"],
      ["task", -2, "17:00", "Задача выполнена: отправить материалы после встречи", "Отправил презентацию и прайс в мессенджер"],
    ],
  },
  "lead-f-07": {
    city: "Бишкек",
    source: "Повторное обращение",
    ai: {
      summary: "Клиент готов оплатить и дважды просил реквизиты. Реквизиты до сих пор не отправлены — риск потерять оплату.",
      nextSteps: ["Отправить реквизиты и QR сегодня", "Подтвердить получение и дату оплаты"],
    },
    activity: [
      ["chat", -1, "18:20", "Сообщение от клиента", "Пришлите, пожалуйста, реквизиты ещё раз"],
      ["meeting", -1, "14:30", "Встреча состоялась", "Готов оплатить, ждёт реквизиты"],
    ],
  },
}

const PAYMENT_STAGES = new Set(["s-prepaid", "c-docs", "c-process"])

export function demoLeadDetail(leadId: string): LeadDetail | null {
  const deal = demoDeals.find((item) => item.id === leadId)
  if (!deal) return null
  const pipeline = demoSalesConfig.pipelines.find((item) => item.id === deal.pipelineId)
  if (!pipeline) return null
  const extra = extras[leadId] ?? {}

  const paymentSource =
    extra.payment ??
    (deal.amount && PAYMENT_STAGES.has(deal.stageId)
      ? { total: deal.amount, items: [["prepayment", (Number(deal.amount) / 2).toFixed(2), -3] as const] }
      : null)
  const paid = addDecimals(paymentSource ? paymentSource.items.map(([, amount]) => amount) : [])

  return {
    id: deal.id,
    title: deal.title,
    client: {
      name: deal.client.name,
      phones: deal.client.phone ? [deal.client.phone] : [],
      email: extra.email ?? null,
      city: extra.city ?? null,
    },
    pipeline,
    stageId: deal.stageId,
    manager: deal.manager,
    amount: deal.amount,
    currency: deal.currency,
    source: extra.source ?? (deal.tags.find((tag) => ["Сайт", "Instagram", "Рекомендация"].includes(tag)) ?? null),
    createdAt: demoAt(-14, "11:00"),
    stageEnteredAt: deal.stageEnteredAt,
    tags: deal.tags,
    nextAction: deal.nextAction,
    aiContext: extra.ai ? { ...extra.ai, generatedAt: demoAt(0, "09:00") } : null,
    payment: paymentSource && {
      total: paymentSource.total,
      paid,
      remaining: subtractDecimal(paymentSource.total, paid),
      currency: "KGS",
      items: paymentSource.items.map(([kind, amount, dayOffset], index) => ({
        id: `${leadId}-pay-${index}`,
        kind,
        amount,
        paidDate: demoAt(dayOffset, "12:00").slice(0, 10),
      })),
    },
    customFields: (extra.fields ?? [["Интерес", null], ["Удобный способ связи", null]]).map(([label, value], index) => ({
      id: `field-${index}`,
      label,
      value,
    })),
    related: [],
  }
}

export function demoLeadActivity(leadId: string): LeadActivity[] {
  const deal = demoDeals.find((item) => item.id === leadId)
  if (!deal) return []
  const stageName =
    demoSalesConfig.pipelines.flatMap((pipeline) => pipeline.stages).find((stage) => stage.id === deal.stageId)?.name ?? ""
  const rows = extras[leadId]?.activity ?? [["stage", 0, "00:00", `Этап: ${stageName}`, null] as const]
  const activity = rows.map(([kind, dayOffset, time, title, body], index) => ({
    id: `${leadId}-act-${index}`,
    at: kind === "stage" && !extras[leadId]?.activity ? deal.stageEnteredAt : demoAt(dayOffset, time),
    kind,
    title,
    body,
    author: kind === "chat" ? deal.client.name : deal.manager.name,
  }))
  const created: LeadActivity = { id: `${leadId}-created`, at: demoAt(-14, "11:00"), kind: "note", title: "Лид создан", body: null, author: null }
  return [...activity, created].toSorted((a, b) => b.at.localeCompare(a.at))
}

export function demoLeadCalls(leadId: string): LeadCall[] {
  const deal = demoDeals.find((item) => item.id === leadId)
  const manager = deal?.manager ?? demoManagers[0]
  return (extras[leadId]?.calls ?? []).map((call, index) => ({ ...call, id: `${leadId}-call-${index}`, manager }))
}
