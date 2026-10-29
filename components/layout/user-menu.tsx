"use client"

import { ChevronDown, FlaskConical, KeyRound, LogOut } from "lucide-react"
import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { routes } from "@/config/routes"
import { signOut } from "@/lib/auth/actions"
import { formatInitials } from "@/lib/format"
import { ROLE_LABELS } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

type UserMenuProps = {
  user: CurrentUser
  isDemoData: boolean
}

/** Профиль: кто вошёл, в какой роли и компании, смена пароля и выход */
export function UserMenu({ user, isDemoData }: UserMenuProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex h-8 items-center gap-1.5 rounded-md pr-1 pl-0.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        aria-label={`Профиль: ${user.fullName}`}
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">{formatInitials(user.fullName)}</AvatarFallback>
        </Avatar>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-0.5 px-1">
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {[ROLE_LABELS[user.role], user.departmentName || null, user.companyName || null].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">Логин: {user.login}</p>
        </div>
        {isDemoData && (
          <p className="mt-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning">
            <FlaskConical className="size-3.5" aria-hidden />
            Демо-сессия: тестовая учётная запись
          </p>
        )}
        <div className="mt-2 space-y-0.5 border-t pt-2">
          <Link
            href={routes.changePassword}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            Сменить пароль
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent">
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
              Выйти
            </button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  )
}
