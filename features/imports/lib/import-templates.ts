import type { ImportEntity } from "@/features/imports/schemas"

export type ImportColumn = { title: string; hint: string; required?: boolean }

/** Колонки, которые узнаёт backend (заголовки по-русски или по-английски) */
export const IMPORT_COLUMNS: Record<ImportEntity, readonly ImportColumn[]> = {
  leads: [
    { title: "Имя", hint: "имя или название", required: true },
    { title: "Телефон", hint: "в международном формате, +996…" },
    { title: "E-mail", hint: "нужен телефон или e-mail" },
    { title: "Источник", hint: "сайт, звонок, WhatsApp, Telegram, Instagram, рекомендация" },
  ],
  customers: [
    { title: "Имя", hint: "имя или название", required: true },
    { title: "Телефон", hint: "в международном формате, +996…" },
    { title: "E-mail", hint: "по телефону и e-mail ищутся дубли" },
  ],
  deals: [
    { title: "Сделка", hint: "название сделки", required: true },
    { title: "Сумма", hint: "число; пусто — 0" },
    { title: "Валюта", hint: "KGS, USD…; пусто — валюта компании" },
    { title: "Воронка", hint: "название; пусто — воронка по умолчанию вашего отдела или компании" },
    { title: "Этап", hint: "название; пусто — первый этап. «Продажа» нельзя: она ставится только оплатой" },
    { title: "Ответственный", hint: "логин или e-mail сотрудника; пусто — выбранный ниже или вы" },
    { title: "Клиент", hint: "имя — если клиента с таким телефоном или e-mail ещё нет, он будет создан" },
    { title: "Телефон", hint: "по телефону или e-mail ищется существующий клиент" },
    { title: "E-mail", hint: "" },
    { title: "Дата закрытия", hint: "ДД.ММ.ГГГГ или ГГГГ-ММ-ДД" },
    { title: "Источник", hint: "" },
    { title: "Следующий шаг", hint: "обязателен для открытого этапа после первого" },
    { title: "Срок шага", hint: "дата следующего шага" },
    { title: "Причина проигрыша", hint: "обязательна для проигранного этапа: из справочника или своими словами" },
  ],
}

const EXAMPLE_ROWS: Record<ImportEntity, readonly string[]> = {
  leads: ["Айгуль", "+996555123456", "", "сайт"],
  customers: ["ОсОО «Альфа»", "+996555123456", "info@alfa.kg"],
  deals: ["Поставка 10 шт", "120000", "", "", "", "", "ОсОО «Альфа»", "+996555123456", "", "31.12.2026", "сайт", "", "", ""],
}

/** Шаблон CSV: «;» и BOM — Excel в русской локали сразу раскладывает колонки и читает кириллицу */
export function importTemplateCsv(entity: ImportEntity): string {
  const header = IMPORT_COLUMNS[entity].map((column) => column.title)
  return `﻿${header.join(";")}\r\n${EXAMPLE_ROWS[entity].join(";")}\r\n`
}

export function importTemplateHref(entity: ImportEntity): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(importTemplateCsv(entity))}`
}

export const IMPORT_TEMPLATE_NAMES: Record<ImportEntity, string> = {
  leads: "шаблон-лиды.csv",
  customers: "шаблон-клиенты.csv",
  deals: "шаблон-сделки.csv",
}
