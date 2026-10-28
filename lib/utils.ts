import { createCn } from "cn/config"

/**
 * Склейка классов с разрешением конфликтов Tailwind. Знает собственные токены проекта:
 * без этого `text-meta` (размер шрифта) считался бы цветом и пропадал рядом с `text-muted-foreground`.
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["meta"] }] } },
})
