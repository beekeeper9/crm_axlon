"use client"

import { useTransition } from "react"
import { Check, ChevronDown, FlaskConical, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { signOut } from "@/lib/auth/actions"
import { formatInitials } from "@/lib/format"
import { ROLE_LABELS, ROLES, type Role } from "@/lib/permissions/roles"
import { setDemoRole } from "@/lib/session/demo-role-actions"
import type { CurrentUser } from "@/lib/session/current-user"

type UserMenuProps = {
  user: CurrentUser
  /** Переключатель роли показывается только на демо-данных */
  isDemoData: boolean
}

export function UserMenu({ user, isDemoData }: UserMenuProps) {
  const [isPending, startTransition] = useTransition()

  function switchRole(role: Role) {
    startTransition(() => setDemoRole(role))
  }

  return (
    <Popover>
      <PopoverTrigger
        className="flex h-8 items-center gap-1.5 rounded-md pr-1 pl-0.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        aria-label={`Профиль: ${user.fullName}`}
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
            {formatInitials(user.fullName)}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="px-1">
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {[ROLE_LABELS[user.role], user.companyName].filter(Boolean).join(" · ")}
          </p>
        </div>

        {isDemoData && (
          <div className="border-t pt-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-warning">
              <FlaskConical className="size-3.5" aria-hidden />
              Демо: смотреть как
            </p>
            <ul aria-busy={isPending}>
              {ROLES.map((role) => (
                <li key={role}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => switchRole(role)}
                    aria-pressed={role === user.role}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60",
                      role === user.role && "font-medium"
                    )}
                  >
                    {ROLE_LABELS[role]}
                    {role === user.role && <Check className="size-4 text-primary" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isDemoData && (
          <form action={signOut} className="border-t pt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
              Выйти
            </button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  )
}
