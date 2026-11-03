import { z } from "zod"

/**
 * `details` записи истории о передаче (лид, клиент, сделка): прежний и новый ответственный.
 * Backend хранит только id и подставляет имена при чтении; имени может не быть.
 */
const personSchema = z.object({ id: z.string(), name: z.string().nullable() })

export const ownerChangeSchema = z
  .object({ fromOwner: personSchema.optional(), toOwner: personSchema.optional() })
  .partial()
  .default({})

export type OwnerChange = z.infer<typeof ownerChangeSchema>

const display = (person: { name: string | null } | undefined) => person?.name || "сотрудник"

/** «от Айбека к Нурлану» — null, если запись не про передачу */
export function ownerChangeText(change: OwnerChange | undefined): string | null {
  if (!change?.fromOwner && !change?.toOwner) return null
  if (!change.fromOwner) return `ответственный: ${display(change.toOwner)}`
  return `от ${display(change.fromOwner)} к ${display(change.toOwner)}`
}
