import { z } from "zod"

/** Сотрудник для фильтров и выбора ответственного. Форма НЕ согласована с backend. */
export const teamMemberSchema = z.object({ id: z.string(), name: z.string() })

export const teamMembersSchema = z.array(teamMemberSchema)

export type TeamMember = z.infer<typeof teamMemberSchema>
