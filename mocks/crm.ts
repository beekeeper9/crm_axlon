/**
 * ДЕМО-ДАННЫЕ CRM: воронки, этапы и лиды вымышленной компании.
 * Лиды из «Фокуса» (lead-f-*) входят в этот набор, задачи и встречи ссылаются на них же.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { Deal, SalesConfig } from "@/features/sales/schemas"
import { DEMO_NOW, demoAt, demoManagers } from "@/mocks/team"

export const demoSalesConfig: SalesConfig = {
  pipelines: [
    {
      id: "sales",
      name: "Продажи",
      stages: [
        { id: "s-repeat", name: "Повторный клиент", kind: "open" },
        { id: "s-booked", name: "Встреча назначена", kind: "open" },
        { id: "s-resched", name: "Перенос встречи", kind: "open" },
        { id: "s-confirmed", name: "Встреча подтверждена", kind: "open" },
        { id: "s-held", name: "Встреча состоялась", kind: "open" },
        { id: "s-interested", name: "Клиент заинтересован", kind: "open" },
        { id: "s-prepaid", name: "Принята предоплата", kind: "open" },
        { id: "s-postponed", name: "Отложенный интерес", kind: "open" },
        { id: "s-won", name: "Успешно реализовано", kind: "won" },
        { id: "s-lost", name: "Закрыто и не реализовано", kind: "lost" },
      ],
    },
    {
      id: "inbound",
      name: "Новые заявки",
      stages: [
        { id: "n-new", name: "Новая заявка", kind: "open" },
        { id: "n-taken", name: "Взят в работу", kind: "open" },
        { id: "n-noanswer", name: "Не дозвонились", kind: "open" },
        { id: "n-qualified", name: "Квалификация", kind: "open" },
        { id: "n-won", name: "Передан в продажи", kind: "won" },
        { id: "n-lost", name: "Некачественная заявка", kind: "lost" },
      ],
    },
    {
      id: "support",
      name: "Сопровождение",
      stages: [
        { id: "c-docs", name: "Сбор документов", kind: "open" },
        { id: "c-process", name: "Оформление", kind: "open" },
        { id: "c-done", name: "Выполнено", kind: "won" },
        { id: "c-lost", name: "Отказ", kind: "lost" },
      ],
    },
  ],
  lossReasons: [
    { id: "price", label: "Дорого" },
    { id: "competitor", label: "Выбрал другую компанию" },
    { id: "no-contact", label: "Не выходит на связь" },
    { id: "changed-mind", label: "Передумал" },
    { id: "timing", label: "Не подходят сроки" },
    { id: "no-service", label: "Нет нужной услуги" },
    { id: "duplicate", label: "Дубль заявки" },
    { id: "other", label: "Другое" },
  ],
}

type ManagerIndex = 0 | 1 | 2 | 3 | 4 | 5

type DemoDealRow = [
  id: string,
  title: string,
  phone: string | null,
  pipelineId: string,
  stageId: string,
  manager: ManagerIndex,
  amount: string | null,
  next: [title: string, dayOffset: number | null, time: string] | null,
  daysOnStage: number,
  tags: string[],
]

const rows: DemoDealRow[] = [
  // Лиды из «Фокуса»
  ["lead-f-01", "Эльнура Мамытова", "+996 555 10-20-31", "sales", "s-interested", 0, "240000.00", ["Ответить про рассрочку", 0, "11:30"], 3, ["Рассрочка"]],
  ["lead-f-02", "ОсОО «Демо Логистик»", "+996 312 90-11-22", "sales", "s-held", 1, "410000.00", ["Отправить договор", null, "00:00"], 1, ["Юрлицо"]],
  ["lead-f-03", "Азамат Жээнбеков", "+996 700 44-55-66", "sales", "s-prepaid", 0, "320000.00", ["Выставить счёт на доплату", 1, "10:00"], 5, []],
  ["lead-f-04", "Гульмира Осмонова", "+996 777 12-12-40", "sales", "s-held", 0, "280000.00", ["Созвониться после семейного обсуждения", 1, "12:00"], 6, []],
  ["lead-f-05", "Руслан Иманов", "+996 555 70-81-92", "sales", "s-interested", 0, "190000.00", null, 9, []],
  ["lead-f-06", "Айпери Касымова", "+996 709 33-21-10", "sales", "s-postponed", 2, "150000.00", ["Напомнить о себе", 7, "10:00"], 12, []],
  ["lead-f-07", "Тилек Бообеков", "+996 550 61-62-63", "sales", "s-held", 3, "360000.00", ["Отправить реквизиты и QR", null, "00:00"], 1, ["Готов оплатить"]],
  ["lead-f-08", "Жанара Абдыраева", "+996 702 18-19-20", "sales", "s-prepaid", 4, "270000.00", ["Подтвердить дату старта", 0, "15:00"], 8, []],
  ["lead-f-09", "Эмир Султанов", "+996 555 90-80-70", "sales", "s-interested", 5, "210000.00", null, 5, []],
  ["lead-f-10", "Нурзат Алиева", "+996 779 40-50-60", "sales", "s-held", 0, null, null, 1, []],
  ["lead-f-11", "Самат Абдраимов", "+996 500 11-22-33", "sales", "s-held", 4, "230000.00", null, 4, []],
  // Остальные сделки воронки «Продажи»
  ["lead-s-01", "Бермет Усенова", "+996 555 21-43-65", "sales", "s-repeat", 0, "260000.00", ["Предложить продление", 2, "11:00"], 2, ["Повторный"]],
  ["lead-s-02", "Канат Мырзабеков", "+996 700 98-76-54", "sales", "s-repeat", 2, null, ["Уточнить потребность", 0, "16:00"], 1, ["Повторный"]],
  ["lead-s-03", "Алия Турдубаева", "+996 777 65-43-21", "sales", "s-booked", 0, "220000.00", ["Встреча в офисе", 0, "17:00"], 2, []],
  ["lead-s-04", "Данияр Кадыров", "+996 555 32-10-98", "sales", "s-booked", 1, null, ["Встреча онлайн", 1, "11:00"], 1, ["Instagram"]],
  ["lead-s-05", "Чолпон Ибраимова", "+996 709 87-65-43", "sales", "s-booked", 3, "180000.00", ["Встреча в офисе", 1, "15:30"], 3, []],
  ["lead-s-06", "Мирлан Асанов", "+996 550 13-57-91", "sales", "s-booked", 5, null, ["Встреча онлайн", 2, "10:00"], 1, []],
  ["lead-s-07", "Айгерим Сапарова", "+996 702 24-68-02", "sales", "s-resched", 0, "200000.00", ["Согласовать новую дату", -1, "18:00"], 4, []],
  ["lead-s-08", "Улан Джумабаев", "+996 555 11-33-55", "sales", "s-resched", 4, null, null, 6, []],
  ["lead-s-09", "Назира Бекова", "+996 777 22-44-66", "sales", "s-confirmed", 0, "300000.00", ["Встреча в офисе", 0, "15:00"], 1, ["Рекомендация"]],
  ["lead-s-10", "Эрлан Токтосунов", "+996 700 55-77-99", "sales", "s-confirmed", 2, "250000.00", ["Встреча онлайн", 0, "18:30"], 2, []],
  ["lead-s-11", "Венера Абдиева", "+996 555 66-88-00", "sales", "s-confirmed", 3, null, ["Встреча в офисе", 1, "12:00"], 1, []],
  ["lead-s-12", "Тынчтык Орозов", "+996 709 10-30-50", "sales", "s-held", 2, "340000.00", ["Отправить расчёт стоимости", 0, "12:00"], 2, []],
  ["lead-s-13", "Асель Кенжебаева", "+996 550 20-40-60", "sales", "s-interested", 1, "295000.00", ["Повторный звонок", 0, "17:30"], 4, []],
  ["lead-s-14", "Бактыгул Шаршенова", "+996 702 70-90-10", "sales", "s-interested", 3, "175000.00", ["Выслать примеры работ", -2, "12:00"], 7, []],
  ["lead-s-15", "Медер Алымкулов", "+996 555 80-60-40", "sales", "s-prepaid", 1, "450000.00", ["Получить остаток оплаты", 3, "10:00"], 3, ["Юрлицо"]],
  ["lead-s-16", "Камила Рахимова", "+996 777 30-20-10", "sales", "s-prepaid", 5, "230000.00", ["Передать в сопровождение", 0, "14:00"], 2, []],
  ["lead-s-17", "Арстан Бейшеев", "+996 700 15-25-35", "sales", "s-postponed", 0, "160000.00", ["Вернуться в декабре", 35, "10:00"], 20, []],
  ["lead-s-18", "Гульзат Мамбетова", "+996 555 45-55-65", "sales", "s-postponed", 4, null, null, 15, []],
  // «Новые заявки»
  ["lead-n-01", "Заявка с сайта · Эрмек", "+996 555 01-02-03", "inbound", "n-new", 0, null, ["Позвонить в течение 15 минут", 0, "13:10"], 0, ["Сайт"]],
  ["lead-n-02", "Сагын Абдылдаев", "+996 700 04-05-06", "inbound", "n-new", 2, null, ["Позвонить в течение 15 минут", 0, "12:40"], 0, ["Instagram"]],
  ["lead-n-03", "Жылдыз Эсенова", "+996 777 07-08-09", "inbound", "n-new", 5, null, null, 0, ["Сайт"]],
  ["lead-n-04", "Кубат Райымбеков", "+996 555 10-11-12", "inbound", "n-taken", 1, null, ["Квалифицировать", 0, "15:00"], 1, []],
  ["lead-n-05", "Айдана Шаршеева", "+996 709 13-14-15", "inbound", "n-taken", 3, null, ["Отправить презентацию", 1, "10:00"], 1, ["Instagram"]],
  ["lead-n-06", "Нурбек Сыдыков", "+996 550 16-17-18", "inbound", "n-noanswer", 0, null, ["Повторный звонок", 0, "16:30"], 2, []],
  ["lead-n-07", "Перизат Жолдошева", "+996 702 19-20-21", "inbound", "n-noanswer", 4, null, ["Написать в мессенджер", -1, "11:00"], 3, []],
  ["lead-n-08", "Ильяс Мамасалиев", "+996 555 22-23-24", "inbound", "n-qualified", 2, "200000.00", ["Назначить встречу", 0, "17:00"], 1, ["Рекомендация"]],
  // «Сопровождение»
  ["lead-c-01", "Роза Акматова", "+996 777 25-26-27", "support", "c-docs", 4, "310000.00", ["Проверить комплект документов", 1, "11:00"], 4, []],
  ["lead-c-02", "Талант Иманалиев", "+996 700 28-29-30", "support", "c-docs", 1, "260000.00", ["Напомнить про справку", -1, "15:00"], 6, []],
  ["lead-c-03", "Мээрим Жунусова", "+996 555 31-32-33", "support", "c-process", 0, "290000.00", ["Сообщить клиенту статус", 2, "12:00"], 9, []],
  // Закрытые сделки — архив клиентской базы
  ["lead-x-01", "Бермет Усенова", "+996 555 21-43-65", "sales", "s-won", 0, "240000.00", null, 190, []],
  ["lead-x-02", "Азамат Жээнбеков", "+996 700 44-55-66", "sales", "s-lost", 0, "180000.00", null, 240, []],
  ["lead-x-03", "Алмаз Кочкоров", "+996 777 34-35-36", "sales", "s-won", 2, "310000.00", null, 120, []],
  ["lead-x-04", "Саида Рысбекова", "+996 709 37-38-39", "sales", "s-lost", 4, null, null, 75, []],
  ["lead-x-05", "ОсОО «Демо Логистик»", "+996 312 90-11-22", "support", "c-done", 1, "520000.00", null, 300, ["Юрлицо"]],
]

function dueAt(next: NonNullable<DemoDealRow[7]>): string | null {
  const [, dayOffset, time] = next
  return dayOffset === null ? null : demoAt(dayOffset, time)
}

function toDeal([id, title, phone, pipelineId, stageId, manager, amount, next, daysOnStage, tags]: DemoDealRow): Deal {
  const nextDueAt = next && dueAt(next)
  return {
    id,
    title,
    client: { name: title, phone },
    pipelineId,
    stageId,
    amount,
    currency: amount === null ? null : "KGS",
    manager: demoManagers[manager],
    nextAction: next && {
      title: next[0],
      dueAt: nextDueAt,
      isOverdue: nextDueAt !== null && new Date(nextDueAt) < new Date(DEMO_NOW),
    },
    stageEnteredAt: demoAt(-daysOnStage, "10:00"),
    // Старые закрытые сделки не менялись с момента закрытия
    updatedAt: daysOnStage > 30 ? demoAt(-daysOnStage, "16:20") : demoAt(-Math.min(daysOnStage, 2), "16:20"),
    tags,
  }
}

export const demoDeals: Deal[] = rows.map(toDeal)
