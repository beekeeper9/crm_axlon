/**
 * ДЕМО-ДАННЫЕ звонков. Транскрипции и анализ — вымышленные примеры, не результат работы модели.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { Call } from "@/features/calls/schemas"
import { demoDeals } from "@/mocks/crm"
import { demoAt } from "@/mocks/team"

type Extra = Pick<Call, "transcript" | "analysis" | "rating">

const NO_EXTRA: Extra = { transcript: null, analysis: null, rating: null }

const extras: Record<string, Extra> = {
  "call-01": {
    transcript: [
      { speaker: "manager", text: "Эльнура, добрый день! Удобно говорить? Хотел узнать, как вам наше предложение после встречи." },
      { speaker: "client", text: "Да, здравствуйте. В целом всё нравится, но сразу всю сумму сложно." },
      { speaker: "manager", text: "Понимаю. Давайте я уточню варианты оплаты частями и вернусь к вам с графиком." },
      { speaker: "client", text: "Хорошо, буду ждать. Лучше в мессенджер." },
    ],
    analysis: {
      summary: "Клиентка готова к покупке, уточняла, можно ли разбить оплату на 2–3 платежа.",
      agreements: ["Менеджер пришлёт варианты оплаты частями в мессенджер"],
      objections: ["Сложно оплатить всю сумму сразу"],
      nextAction: "Отправить график платежей и договориться о дате первого платежа",
      generatedAt: demoAt(-2, "16:20"),
    },
    rating: { score: 4, comment: "Хорошо выявил потребность. Не назначил точное время следующего контакта." },
  },
  "call-03": {
    transcript: null,
    analysis: {
      summary: "Подтвердил получение предоплаты, попросил прислать счёт на остаток на почту.",
      agreements: ["Счёт на остаток — на почту клиента"],
      objections: [],
      nextAction: "Выставить счёт на доплату",
      generatedAt: demoAt(-2, "16:30"),
    },
    rating: { score: 3, comment: "Не уточнил дату оплаты остатка." },
  },
  "call-05": {
    transcript: [
      { speaker: "client", text: "Здравствуйте, я по поводу договора. Наш юрист хочет посмотреть его до подписания." },
      { speaker: "manager", text: "Конечно, пришлю сегодня. Есть пункты, которые уже сейчас вызывают вопросы?" },
      { speaker: "client", text: "Сроки поставки и ответственность за задержку." },
    ],
    analysis: {
      summary: "Клиент готов подписать после проверки договора юристом. Вопросы — сроки и ответственность за задержку.",
      agreements: ["Договор отправить сегодня"],
      objections: ["Сроки поставки", "Ответственность за задержку"],
      nextAction: "Отправить договор с пояснениями по срокам",
      generatedAt: demoAt(0, "09:40"),
    },
    rating: { score: 5, comment: null },
  },
  "call-08": {
    transcript: null,
    analysis: null,
    rating: null,
  },
}

type Row = [id: string, leadId: string | null, phone: string | null, dayOffset: number, time: string, direction: Call["direction"], status: Call["status"], durationSec: number]

const rows: Row[] = [
  ["call-01", "lead-f-01", null, -2, "16:05", "outgoing", "answered", 252],
  ["call-02", "lead-f-01", null, -7, "11:20", "incoming", "answered", 95],
  ["call-03", "lead-f-03", null, -2, "16:10", "outgoing", "answered", 160],
  ["call-04", "lead-n-06", null, 0, "10:15", "outgoing", "missed", 0],
  ["call-05", "lead-f-02", null, 0, "09:20", "incoming", "answered", 214],
  ["call-06", "lead-f-04", null, -1, "17:40", "outgoing", "answered", 22],
  ["call-07", "lead-n-01", null, 0, "12:58", "incoming", "missed", 0],
  ["call-08", "lead-s-13", null, 0, "11:05", "outgoing", "answered", 187],
  ["call-09", null, "+996 555 77-88-99", 0, "11:45", "incoming", "answered", 64],
  ["call-10", "lead-f-07", null, -1, "18:25", "incoming", "answered", 48],
  ["call-11", "lead-s-12", null, -1, "12:10", "outgoing", "answered", 133],
  ["call-12", "lead-n-07", null, -1, "11:00", "outgoing", "missed", 0],
]

export const demoCalls: Call[] = rows.map(([id, leadId, phone, dayOffset, time, direction, status, durationSec]) => {
  const deal = leadId ? demoDeals.find((item) => item.id === leadId) : undefined
  return {
    id,
    at: demoAt(dayOffset, time),
    direction,
    status,
    durationSec,
    phone: deal?.client.phone ?? phone ?? "",
    lead: deal ? { id: deal.id, name: deal.title } : null,
    manager: deal?.manager ?? { id: "m-1", name: "Айбек Садыков" },
    hasRecording: status === "answered" && durationSec > 0,
    ...(extras[id] ?? NO_EXTRA),
  }
})
