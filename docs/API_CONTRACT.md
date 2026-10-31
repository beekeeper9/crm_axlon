# Взаимодействие с Python backend

Документ разделён на две части:
- **Согласовано** — правила, которые подтвердил backend-разработчик (28.10.2026). Frontend уже им следует.
- **Предложения** — формы данных, которые нужны интерфейсу. Они **не согласованы**: пути не придуманы, HTTP-реализации выбрасывают `contract_pending`, экраны работают на демо-данных.

---

## Часть 1. Согласовано

### Транспорт — `lib/api/client.ts`

| Правило | Как реализовано |
|---------|-----------------|
| JSON, поля в `snake_case` | `lib/api/case.ts`: ответ → `camelCase`, тело и параметры запроса → `snake_case`. Только в API-клиенте, компоненты работают с `camelCase` |
| Базовый URL | `API_BASE_URL` — только для сервера Next.js, в браузер не попадает (проверяется в `config/env.ts`) |
| Режим данных | `NEXT_PUBLIC_DATA_SOURCE=mock\|api`; репозитории модулей выбирают реализацию один раз |
| Авторизация JWT Bearer | Заголовок `Authorization: Bearer <access>`; без cookie-сессий и без `credentials: "include"` |
| Компания | Заголовок `X-Tenant: <slug>` для бизнес-запросов; slug из `GET /api/v1/me/` → `memberships[].tenant`. Tenant в путь не добавляется |
| Обновление токена | При 401 — один запрос `POST /api/v1/auth/token/refresh/` с `{ refresh }`, новый refresh из ответа сохраняется, старый больше не используется (backend: ротация + чёрный список, окна повторного использования нет). Параллельные запросы ждут одно общее обновление. Backend отклонил refresh (400/401) — токены удаляются, ошибка `unauthorized`; временный сбой (нет связи, 429, 5xx) — токены **не** удаляются, пользователь не выходит из системы |
| Проверка ответов | Каждый ответ проверяется Zod-схемой модуля; несовпадение → `invalid_response` |

### Авторизация — `lib/api/auth-api.ts`

| Endpoint | Назначение |
|----------|-----------|
| `POST /api/v1/auth/token/` | Логин → `{ access, refresh }` |
| `POST /api/v1/auth/token/refresh/` | `{ refresh }` → новая пара (refresh ротируется) |
| `GET /api/v1/me/` | `{ id, username, display_name?, is_platform_admin?, must_change_password?, memberships: [{ tenant, role, company?, department?, permissions? }] }` (поля с `?` — с backend P0-1) |
| `POST /api/v1/auth/logout/` | Завершить текущую сессию (один refresh) |
| `POST /api/v1/auth/logout-all/` | Завершить все сессии |
| `POST /api/v1/auth/password/change/` | `{ current_password, new_password }` → 204, снимает `must_change_password` (backend P0-1) |

Подключено: страницы `/login`, `/select-company`, выход в меню профиля, обновление токена в `proxy.ts`. Токены хранит сервер Next.js в httpOnly-cookie (см. `DECISIONS.md`). В режиме `mock` вход не нужен и не имитируется.

Проверено 31.10.2026 на реальном backend (ветка `feature/p0-4-cabinet`, локальный docker compose): неверный пароль с `request_id`, вход директора, РОП и менеджера (имя, роль и компания из `/me/`), возврат на `next`, MFA (`mfa_required` → поле кода → `invalid_otp` → вход), блокировка `account_locked`, ротация refresh в `proxy.ts` и выход на вход при отклонённом refresh, выход с отзывом токена (backend 205). Токены не видны из JS и не попадают в логи.

Один пользователь — одна активная компания: backend запрещает второе активное членство (`membership_one_active_per_user`). Поэтому `/select-company` с этим backend не показывается; страница остаётся на случай платформенного администратора и будущих изменений.

### Вход: фактическое поведение backend (сверено с кодом ветки `feature/p0-4-cabinet`, 31.10.2026)

- Тело входа: `{ username, password, otp? }`. Ответ — `{ access, refresh }`. Access живёт 10 мин, refresh — 24 ч (настройки backend по умолчанию), в токенах есть `exp`.
- Ошибки входа (`lib/auth/actions.ts` → `apiLoginError`):
  - 401 `authentication_failed` — неверный логин или пароль **и** отключённый аккаунт (backend их не различает) → «Неверный логин или пароль»;
  - 401 `mfa_required` — у аккаунта включена MFA → форма показывает поле кода, запрос повторяется с `otp`;
  - 401 `invalid_otp` — неверный код;
  - 429 `account_locked` — временная блокировка после неудачных попыток (без `Retry-After`);
  - 429 `throttled` — ограничение частоты (с заголовком `Retry-After`).
- `/me/` с P0-1: `display_name` (имя и фамилия или логин), `is_platform_admin`, `must_change_password`, у членства — `company { id, name, country, currency, timezone }`, `department { id, name } | null`, `permissions[]`. Поля необязательны в схеме frontend, чтобы работать и с более ранней версией backend.
- **Ограничение backend:** `must_change_password` проверяет только frontend — backend не запрещает другие запросы с временным паролем.
- **Риск ограничения частоты:** все запросы идут с сервера Next.js, то есть с одного IP. Анонимные `auth/token/` и `auth/token/refresh/` попадают в общий лимит `auth` (10/мин) на всех пользователей. Нужно решение backend (`TRUSTED_PROXY_COUNT` + `X-Forwarded-For` или лимит refresh по токену). Не проверено под нагрузкой.

### Ошибки — `lib/api/errors.ts`

Тело: `{ "error": { "code", "message", "details"?, "request_id" } }`.

- `code = validation_error` → `ApiError.kind = "validation"`, `details` (формат DRF `{ field: ["…"] }`) → `ApiError.fieldErrors` с именами полей в `camelCase`.
- Остальные коды: вид ошибки по HTTP-статусу (401, 403, 404, 400/422, 409 → `conflict`, 429 → `rate_limited` с `retryAfterSeconds` из `Retry-After`, прочие → server). 404 без `X-Tenant` — тоже `not_found`.
- `request_id` сохраняется в `ApiError.requestId` для логов и обращения в поддержку. Пользователю показываются только понятные тексты из `API_ERROR_MESSAGES`, без технических подробностей.

### Пагинация — `lib/api/pagination.ts`

`limit` 1–200 (по умолчанию 50), `offset` от 0. Ответ `{ count, results }`, без `next`/`previous`. Страницы считаются из `count`, `limit`, `offset` (`pageInfo`). Фильтры и сортировка — свои у каждого endpoint, универсального формата нет.

### Деньги и даты — `lib/api/money.ts`, `lib/format.ts`, `lib/datetime.ts`

- Деньги — десятичная строка (`"1500.00"`) и отдельное поле `currency` (ISO). Во frontend сумма остаётся строкой; форматирование — `formatDecimalMoney` (Intl форматирует строку без перевода во float). Там, где интерфейс сам пересчитывает итог (демо-перенос сделки), — точная арифметика `lib/decimal.ts`.
- `*_at` — UTC ISO 8601; показываются в часовом поясе компании. `*_date` — `YYYY-MM-DD`.
- Поля ввода даты переводятся в ISO с учётом часового пояса компании (`companyWallTimeToIso`), а не браузера.

### Роли — `lib/permissions/backend-roles.ts`

Хранимые роли backend (`access_control/domain/rbac.py`, ветка P0) и роли интерфейса — только в `uiRoleFromBackend`, повторяет `PRODUCT_ROLES` backend:

| Backend | Интерфейс |
|---------|-----------|
| `owner`, `admin`, `director` | Директор |
| `manager` (устаревшее), `head_of_sales` | Руководитель отдела продаж |
| `sales_rep` | Менеджер |
| `lead_caller` | Первичная обработка лидов (рабочее пространство в продукте не описано — минимальный набор прав) |
| `operations` | Операционный отдел (то же) |
| `viewer` | Наблюдатель |

«Администратор платформы» — признак `is_platform_admin` в `/me/`, а не роль компании. Скрытие кнопок — только удобство: backend проверяет RBAC и область `own/team/all` на каждой операции. Список `permissions` из `/me/` frontend пока читает, но не использует для отображения — следующий шаг.

---------|-----------|--------|
| `owner` | Директор | предложение |
| `admin` | Директор | **уточнить**: это администратор компании? |
| `manager` | Руководитель отдела продаж | предложение (backend `manager` = руководитель) |
| `sales_rep` | Менеджер | предложение |
| `viewer` | Наблюдатель (только просмотр) | предложение |

«Администратор платформы» — не роль компании; как он определяется, нужно согласовать. Скрытие кнопок — только удобство: backend проверяет RBAC и область `own/team/all` на каждой операции и не отдаёт закрытые данные (пример — оценка звонка).

---

## Часть 2. Предложения (не согласовано)

Все схемы — в `features/*/schemas.ts`, имена полей ниже в `camelCase` (в API — `snake_case`).

### Вопросы к backend

1. **Capabilities.** Нужен ли список прав пользователя (`can_move_deal`, `can_assign_tasks`, `can_see_call_rating`…) в `GET /me/` или отдельным endpoint? Сейчас интерфейс выводит права из роли.
2. **Имя пользователя и компании.** `/me/` возвращает `username`; для шапки нужны ФИО, название компании и отдела.
3. **Хранение токенов** — выбрано: сервер Next.js держит токены в httpOnly-cookie, в backend уходят только Bearer-заголовки. Все запросы идут с сервера Next.js, CORS для браузера не нужен. Подтвердить у backend и уточнить:
   - поля тела логина (`username`, `password`?) и код ответа при неверном пароле;
   - срок жизни access и refresh, есть ли `exp` в токенах;
   - есть ли короткое окно, в котором старый refresh ещё принимается после ротации (нужно, если серверов Next.js будет несколько);
   - что backend делает при повторном использовании старого refresh (отзывает все сессии?).
4. **Поиск по клиентам** для форм (выбор лида при назначении встречи): endpoint с `search` и `limit`.
5. **Часовой пояс компании** — в данных компании или фиксированный.

### Сотрудники — `features/team` (подключено к P0)

`GET /api/v1/staff/` → `[{ id: user_id, name: full_name || login }]` без деактивированных. Id — пользователя, как `owner_user_id` у сделки и `manager_id` в фильтре. Менеджер (`sales_rep`) получает 403: фильтр по сотрудникам ему не показывается, имена в сделках не загружаются.

### Продажи — `features/sales` (подключено к P0, проверено 31.10.2026 на локальном backend)

Интерфейс работает со своими схемами (`features/sales/schemas.ts`), ответы backend переводит `features/sales/api/sales-repository.ts`.

- **Настройки воронок** — `GET /sales/pipelines/` (массив без пагинации) и `GET /sales/loss-reasons/?active=true` (`{count, results}`). Неактивные этапы скрываются, этапы — по `position`, воронка `is_default` — первой; воронка без активных этапов не показывается.
- **Доска** — отдельного endpoint нет: `GET /sales/pipelines/{id}/` и по запросу `GET /sales/deals/?pipeline_id&stage_id&status=open&limit=50` на каждый рабочий этап; `count` этапа — из ответа. **Суммы этапов backend не считает** — колонка показывает «—».
- **Таблица и «Список»** — `GET /sales/deals/` с `pipeline_id`, `stage_id`, `manager_id`, `search`, `attention`, `ordering`, `limit/offset`. Сортировка: `updated_at`, `amount`, `title` (± ). Сортировка по следующему шагу убрана: backend её не поддерживает и молча подставил бы сортировку по умолчанию.
- **Смена этапа** с доски в режиме api недоступна (`editMode = unavailable`), ничего не имитируется.

Пробелы backend (`DealReadSerializer`), поля остаются пустыми, а не придумываются:

| Нужно интерфейсу | Сейчас | Предложение |
|---|---|---|
| Клиент: имя и телефон | только `customer_id` | вложить `customer { id, name, phone }` в список сделок |
| «Обновлено» | нет `updated_at` в ответе (хотя сортировка по нему есть) | добавить `updated_at` |
| «На этапе с» | нет | `stage_entered_at` (есть в истории смены этапов) |
| Срок следующего шага и просрочка | `next_step` — только текст | `next_step_due_at`; `attention=overdue` сейчас значит «просрочена ожидаемая дата закрытия», а кнопка в «Списке» названа «Шаг просрочен» |
| Сумма по этапу | нет | `count` и `total_amount` по этапам одним запросом (`GET /sales/pipelines/{id}/board/`) |
| Имя ответственного | только `owner_user_id`, имена — через `/staff/` (менеджеру 403) | вложить `owner { id, name }` |
| Поиск | `title` и `source` | также телефон и имя клиента (подсказка в поле поиска это обещает) |

### Карточка лида — `features/leads/schemas.ts`

**Подключено к backend (31.10.2026, ветка backend `feature/deal-detail-embeds`):** `GET /sales/deals/{id}/` с вложенными `customer { id, name, email, phone } | null` (null — клиент не привязан или недоступен пользователю по правилам модуля клиентов) и `owner { id, name }`; воронка — `GET /sales/pipelines/{id}/`; «На этапе с» — последняя запись `GET /sales/deals/{id}/stage-history/`, без смен этапа — `created_at`. 404 (чужая или несуществующая сделка) → «Страница не найдена». Не отдаются и остаются пустыми: город клиента, метки, сводка ИИ, свои поля, другие сделки клиента; вкладка «Оплата» в режиме api скрыта, вкладки «Работа», «История», «Звонки» показывают «Раздел ещё не подключён».

`leadDetailSchema`: `id, title, client { name, phones[], email, city }, pipeline { id, name, stages[] }, stageId, manager, amount, currency, source, createdAt, stageEnteredAt, tags[], nextAction, aiContext { summary, nextSteps[], generatedAt } | null, payment { total, paid, remaining, currency, items[{ id, kind: prepayment|additional|full, amount, paidDate }] } | null, customFields [{ id, label, value }], related [{ id, title, pipelineName, stageName }]`.

Отдельные запросы (каждая вкладка загружается независимо):
- **История** `[{ id, at, kind: call|chat|note|stage|task|meeting|payment, title, body, author }]`, новые сверху.
- **Звонки** `[{ id, at, direction, durationSec, manager, summary, transcript[{ speaker, text }] | null, rating { score 1–5, comment } | null }]`. **`rating` backend отдаёт только руководителям**; демо-слой повторяет это правило.
- Задачи и встречи лида — списки модулей «Задачи» и «Встречи» с фильтром `lead_id`.

Не хватает полей (нужно решение): **документы** (файлы, договоры), **переписка** (мессенджеры), **запись звонка** (ссылка на аудио и права на прослушивание), **редактирование полей** и схема настраиваемых полей компании (типы, обязательность), **история изменений этапов** с автором, **связанные контакты** (несколько людей у одной сделки).

### Задачи — `features/tasks/schemas.ts`

**Подключено (задачи сделки на карточке, только чтение):** `GET /activities/?kind=task&subject_type=deal&subject_id={id}` (P0). Видимость задаёт backend: менеджер — свои (владелец задачи = исполнитель), РОП — команды, руководитель — все. Перевод в интерфейс: срок — только дата (`due_date`, без времени), `is_overdue` и `due_group` (`overdue|today|this_week|later`; открытая без срока → `no_due`) считает backend по дню компании; `completed` → выполнено, `cancelled` не показывается; тип `follow_up|other` → «Задача»; приоритет `high|urgent` → «важная». Имена исполнителя и автора — из `/staff/`; менеджеру (403) известно только своё имя. Ограничение backend: не больше 2 открытых задач на сделку (409). Не подключено: создание, выполнение и правка задач, страница «Задачи» (у backend нет фильтров по исполнителю и поиска, нет «моих задач на сегодня»).

`taskSchema`: `id, title, description, type (call|meeting|email|todo), priority (high|normal), status (open|done), dueAt | null, isOverdue, dueGroup (overdue|today|tomorrow|this_week|next_week|later|no_due) | null, assignee | null, createdBy, lead { id, name } | null, completedAt, result`.
**Просрочку и группу срока считает backend** в часовом поясе компании. Список: `{ count, results }`, фильтры `status` (open|done|all), `assignee_id` (или «без исполнителя»), `lead_id`, `search`. «Мой день» использует `{ date, tasks, overdueFromPreviousDays }`.

Нужны операции: создать, изменить, выполнить с результатом, взять задачу без исполнителя. Правило «не больше 2 открытых задач на сделку» проверяет backend (`validation_error`).

### Встречи — `features/meetings/schemas.ts`

`meetingSchema`: `id, startsAt, endsAt | null, lead { id, name }, format (office|online|visit), location, host (проводит), bookedBy (назначил), status (scheduled|confirmed|held|no_show|rescheduled|cancelled), clientConfirmation (confirmed|not_confirmed|not_sent), outcomeRequired, notes, outcomeComment`.
Фильтры: `period` (yesterday|today|tomorrow|week — границы дней на backend) или произвольный интервал (уточнить формат), `status`, `host_id`, `lead_id`, `search`, `outcome_required`.
Нужны операции: назначить, записать итог (`held|no_show|rescheduled` + новая дата и комментарий), отменить. `outcomeRequired`, напоминания (за 24 ч и 2 ч) и списание через 14 дней — на backend.

### После встречи — `features/after-meeting/schemas.ts`

Очередь: `{ groups: [{ id: outcome_required|no_next_step|awaiting_decision, title, description, items }] }`. Элемент: встреча (`id, startsAt, format, host, outcomeComment`), лид (`id, name, phone`), воронка, этап, сумма, текущий следующий шаг, `aiHint`. **Группы раскладывает backend.**
Нужна операция «обработать после встречи»: итог (если не записан: `held|no_show|rescheduled` + новая дата), краткий итог, договорённости, следующий шаг (создаёт задачу). Один запрос или два (итог встречи + задача) — решить с backend.

### База клиентов — `features/clients/schemas.ts`

Клиент — человек или компания с одной или несколькими сделками (в том числе закрытыми). Отдельной сущности в контракте пока нет.
Список: `{ id, name, phones[], email, city, manager, openDealsCount, dealsCount, currentDeal { id, stageName } | null, lastInteractionAt }`; фильтры `search` (имя и телефон по всей истории, включая архив; телефон — по цифрам), `status` (`active` — есть открытая сделка, `archive`), `manager_id`. Детали: + `deals[]` (`id, title, pipelineName, stageName, stageKind, amount, currency, updatedAt`) и `recentActivity[]`.
Вопросы: как backend склеивает дубли (один телефон — разные имена), есть ли у клиента собственные поля (компания, ИНН), отдельная карточка клиента или достаточно панели.

### Звонки — `features/calls/schemas.ts`

`{ id, at, direction (incoming|outgoing), status (answered|missed), durationSec, phone, lead | null, manager, hasRecording, transcript[{ speaker, text }] | null, analysis { summary, agreements[], objections[], nextAction, generatedAt } | null, rating { score 1–5, comment } | null }`.
Фильтры: `direction`, только пропущенные, `manager_id`, `lead_id`, `search` (клиент, номер). **`rating` — только руководителям**, остальным backend отдаёт `null` (демо-слой повторяет правило — проверено: у менеджера оценки нет даже в HTML).
Вопросы: ссылка на запись и права на прослушивание; когда появляется `analysis` (задержка обработки); порог «от 30 секунд» — на backend.

### Область видимости — обязательное требование к backend

Для роли `sales_rep` все списки и карточки (сделки, задачи, встречи, звонки, клиенты, «Фокус», «После встречи») возвращают только записи сотрудника; чужая запись по id — 404. Параметры фильтра по сотруднику (`manager_id`, `host_id`, `assignee_id`) для менеджера игнорируются. Список коллег со счётчиками («Фокус» → `managers`) менеджеру не отдаётся. Демо-слой (`mocks/scope.ts`) повторяет это правило.

### «Мой день» менеджера — `features/my-day/schemas.ts`

Только для текущего пользователя (из токена), без параметра «чей».
- **Месяц** `myMonthSchema` (`month=YYYY-MM`, один запрос на страницу): `period { month, label, isCurrent, workDaysTotal, workDaysLeft }`; `now` (только текущий месяц) `{ awaitingReply { count, longestWaitWorkMinutes }, meetingsToday { held, total }, meetingsWithoutOutcome, reschedulesWithoutDate, tasks { overdue, dueToday } }`; `turnover { fact, target, expectedToDate, forecast, progress, expectedProgress, growth { amount, comparedTo }, prepayments, additionalPayments, note }`; `earnings { total, notice, lines[{ label, amount, note }], footnote } | null`; `kpis { sales { count, growth, comparedTo, planNote }, salesPerMeeting { ratio, sales, held, bonusThreshold }, averageDeal { amount, note }, meetingsHeld { count, attendance, upcoming } }`; `monthFunnel { assigned, passed, held, sales, upcoming }`; `daily[{ date, cumulative, plan, turnover, sales }]`; `segments[{ id, name, sales, previousSales, turnover, prepayments, additionalPayments, averageDeal, share }]`. Деньги — десятичные строки и `currency`. **Все расчёты (рабочие дни, план к дню, прогноз, заработок) — backend.** Нет данных за месяц — `null` (или 404).
- **Дела на сегодня** `todayActionsSchema`: `asOf`, `actions[{ id, kind (reply | overdue_task | meeting_outcome | confirm_meeting | no_next_step | stale_deal), urgency (now | today | soon), lead { id, name }, problem, detail, at, amount, currency }]`. Отбор, срочность и порог «давно без движения» — правила backend; один пункт на клиента.
- Расписание дня — существующие «Встречи» (`period=today`) и «Задачи на сегодня»; сделки в фокусе — «Фокус» (добавлены `amount`, `currency`).

### Кабинет РОПа — `features/team-cabinet/schemas.ts`

Доступ — роли РОП, директор, админ; остальным 403. Числа — детерминированно (SQL), совпадают с «Отчётами дня», «Встречами», «Звонками».
- **Сегодня** `teamTodaySchema`: `asOf` («данные на HH:MM»), `workDay { number, total, monthLabel }`, `attention[{ id, priority, manager, problem, value, target }]`, `rows[{ manager, level (green|yellow|red), reasons[], absence { kind, label, until } | null, inactiveDays, dayScore (2–5 | null), today { meetings { total, confirmed, toConfirm, nextToConfirmAt, held, noShow, rescheduled, cancelled, withoutOutcome }, payments { count, amount, currency }, calls { total, answered, conversations, minutes }, waitingReplies { count, maxWaitHours }, tasks { today, overdue, unassigned }, hygiene { withoutOutcome, rescheduledNoDate, noNextStep } }, plan }]`, `department { today, plan }` — агрегат backend.
- **План** `planSchema`: `target | null` (план продаж — клиенты с первым платежом), `fact`, `remaining`, `workDaysTotal`, `workDaysLeft`, `expectedToDate`, `perDayNeeded`, `forecast` (линейный), `meetingsHeldNeeded`, `meetingsToBookNeeded`, `meetingToSale`, `attendance`.
- **Встречи и звонки** `teamQualitySchema` (`period=week|month`): итоги встреч, `heldWithoutSale[]`, `calls[{ manager, total, conversations, rated, avgScore, goalAchievedShare, nextStepShare }]`, `toListen[{ callId, lead, manager, score, kind (weak|strong), summary }]`. Причины отмен — нужны.
- **Воронка** `teamFunnelSchema`: по этапам `count`, `amount`, `medianAgeDays`, `staleCount` (дольше `staleThresholdDays`), `conversionToNext | null`, `isPile`. Без истории переходов конверсия = null.
- **Карточка менеджера** `memberCardSchema` (14 дней): `dayScores[]`, `plan`, оплаты, `activity[{ date, calls, conversations, isWorkDay }]`, `discipline`, `callQuality { rated, total, distribution, goalAchievedShare, nextStepShare, gaps[] } | null`, `focusPoints[]` (правила, не ИИ), `dealsToPush[]`, `toListen[]`.
- **Звонки:** в разбор добавлен признак `goal` (achieved | partial | missed) — «цель звонка да/частично/нет» из ТЗ.

Не подключено (нужны контракты): «Срез на планёрку» и отправка в Telegram, задание планов (форма и история), график отсутствий с типами, выгрузки без телефонов, итоги one-to-one (P2), калибровка оценок ИИ.

### Сотрудники и аккаунты — `features/staff` (предложение, не согласовано)

Публичной регистрации нет. Аккаунты создаются только внутри системы по иерархии; **роль нового аккаунта назначает сервер по роли создателя**, в запросе её нет:

| Создатель | Создаёт | Компания и отдел |
|-----------|---------|------------------|
| Администратор платформы | Директора | Новая компания (`company_name`) |
| Директор (`owner`) | РОПа (`manager`) | Своя компания, отдел из своей компании |
| РОП (`manager`) | Менеджера (`sales_rep`) | Своя компания и **свой** отдел (переданный отдел игнорируется) |
| Менеджер, наблюдатель | — | 403 |

Предлагаемые endpoint:
- `GET /api/v1/staff/` (X-Tenant) — сотрудники в области пользователя: директор — компания, РОП — свой отдел. `{ count, results: [{ id, login, full_name, role, company { id, name }, department { id, name } | null, status: active|invited|deactivated, created_by { id, name } | null, created_at }] }`.
- `GET /api/v1/staff/create-options/` — `{ creatable_role, requires_company_name, departments[{ id, name }], fixed_department | null, login_is_optional }`.
- `POST /api/v1/staff/` — `{ full_name, login?, department_id?, company_name? }` → 201 `{ member, temporary_password }`. **Временный пароль генерирует сервер и возвращает один раз**; повторно получить его нельзя. Ошибки: 403 `permission_denied`, 400 `validation_error` (`login` занят, `department_id` чужой, нет `company_name`).
- `POST /api/v1/auth/password/change/` — `{ current_password, new_password }` → 204; снимает `must_change_password`. Правила пароля — на backend (сейчас интерфейс подсказывает «не короче 8 символов»).
- Нужны позже: деактивация (`POST /api/v1/staff/{id}/deactivate/`), выдача нового временного пароля, перевод между отделами, список компаний для администратора платформы.

Принадлежность: у каждого аккаунта — компания, отдел (кроме директора), кто создал. Область видимости РОПа — только его отдел; несколько отделов у одного РОПа — вопрос к backend.

В режиме api все эти экраны показывают «не подключено» и ничего не создают. В демо-режиме работают на хранилище в памяти сервера (`mocks/demo-accounts.ts`).

### «Фокус», рабочее пространство

Без изменений: `focusListSchema` (+ `amount`, `currency` у элемента). Раскладка рабочего пространства убрана вместе со старой главной; вернётся отдельным контрактом, когда будет утверждена настройка РОПом.
