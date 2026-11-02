import { isMockDataSource } from "@/config/env"
import { fetchInbox } from "@/features/notifications/api/notifications-repository"
import { NotificationsPopover } from "@/features/notifications/components/notifications-popover"
import { apiErrorMessage } from "@/lib/api/errors"
import { tryLoad } from "@/lib/api/load"

const LATEST_LIMIT = 15

/** Колокольчик в шапке: последние уведомления пользователя. В демо-режиме уведомлений нет — колокольчика тоже */
export async function NotificationsBell() {
  if (isMockDataSource) return null
  const inbox = await tryLoad(() => fetchInbox(LATEST_LIMIT))
  return inbox.ok ? (
    <NotificationsPopover unread={inbox.data.unread} items={inbox.data.items} failure={null} />
  ) : (
    <NotificationsPopover unread={0} items={[]} failure={apiErrorMessage(inbox.error)} />
  )
}
