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
| Базовый URL | `NEXT_PUBLIC_API_BASE_URL` (проверяется в `config/env.ts`) |
| Режим данных | `NEXT_PUBLIC_DATA_SOURCE=mock\|api`; репозитории модулей выбирают реализацию один раз |
| Авторизация JWT Bearer | Заголовок `Authorization: Bearer <access>`; без cookie-сессий и без `credentials: "include"` |
| Компания | Заголовок `X-Tenant: <slug>` для бизнес-запросов; slug из `GET /api/v1/me/` → `memberships[].tenant`. Tenant в путь не добавляется |
| Обновление токена | При 401 — один запрос `POST /api/v1/auth/token/refresh/` с `{ refresh }`, новый refresh из ответа сохраняется, старый больше не используется. Параллельные запросы ждут одно общее обновление (иначе второй отправил бы уже ротированный токен). Если обновление не удалось — токены удаляются, ошибка `unauthorized` |
| Проверка ответов | Каждый ответ проверяется Zod-схемой модуля; несовпадение → `invalid_response` |

### Авторизация — `lib/api/auth-api.ts`

| Endpoint | Назначение |
|----------|-----------|
| `POST /api/v1/auth/token/` | Логин → `{ access, refresh }` |
| `POST /api/v1/auth/token/refresh/` | `{ refresh }` → новая пара (refresh ротируется) |
| `GET /api/v1/me/` | `{ id, username, memberships: [{ tenant, role }] }` |
| `POST /api/v1/auth/logout/` | Завершить текущую сессию (один refresh) |
| `POST /api/v1/auth/logout-all/` | Завершить все сессии |

Подключено: страницы `/login`, `/select-company`, выход в меню профиля, обновление токена в `proxy.ts`. Токены хранит сервер Next.js в httpOnly-cookie (см. `DECISIONS.md`). В режиме `mock` вход не нужен и не имитируется.

Проверено 28.10.2026 на локальной заглушке, повторяющей согласованные ответы (не на реальном backend): вход и ошибка входа с `request_id`, выбор компании, три параллельных запроса с истёкшим access → один обмен refresh-токена без повторного использования, отклонённый refresh → очистка cookie и переход на вход, выход.

### Чего не хватает для входа (предложение, нужно backend)

`GET /api/v1/me/` — дополнительные необязательные поля (frontend уже читает их, если они придут):
- `full_name` — для шапки вместо логина;
- `is_platform_admin: boolean` — **блокирующий вопрос:** администратор платформы не член компании, и по `memberships` его нельзя отличить. Без этого флага панель администратора в режиме api недоступна;
- `must_change_password: boolean` — пользователь вошёл по временному паролю; пока true, frontend пускает только на смену пароля.

Коды ошибок входа (`POST /api/v1/auth/token/`): неверный логин или пароль — 401 без уточнения, что именно неверно; отключённый аккаунт — `account_disabled` (сообщать только при верном пароле, чтобы не раскрывать существование аккаунтов).

### Ошибки — `lib/api/errors.ts`

Тело: `{ "error": { "code", "message", "details"?, "request_id" } }`.

- `code = validation_error` → `ApiError.kind = "validation"`, `details` (формат DRF `{ field: ["…"] }`) → `ApiError.fieldErrors` с именами полей в `camelCase`.
- Остальные коды: вид ошибки по HTTP-статусу (401, 403, 404, 400/422, прочие → server). 404 без `X-Tenant` — тоже `not_found`.
- `request_id` сохраняется в `ApiError.requestId` для логов и обращения в поддержку. Пользователю показываются только понятные тексты из `API_ERROR_MESSAGES`, без технических подробностей.

### Пагинация — `lib/api/pagination.ts`

`limit` 1–200 (по умолчанию 50), `offset` от 0. Ответ `{ count, results }`, без `next`/`previous`. Страницы считаются из `count`, `limit`, `offset` (`pageInfo`). Фильтры и сортировка — свои у каждого endpoint, универсального формата нет.

### Деньги и даты — `lib/api/money.ts`, `lib/format.ts`, `lib/datetime.ts`

- Деньги — десятичная строка (`"1500.00"`) и отдельное поле `currency` (ISO). Во frontend сумма остаётся строкой; форматирование — `formatDecimalMoney` (Intl форматирует строку без перевода во float). Там, где интерфейс сам пересчитывает итог (демо-перенос сделки), — точная арифметика `lib/decimal.ts`.
- `*_at` — UTC ISO 8601; показываются в часовом поясе компании. `*_date` — `YYYY-MM-DD`.
- Поля ввода даты переводятся в ISO с учётом часового пояса компании (`companyWallTimeToIso`), а не браузера.

### Роли — `lib/permissions/backend-roles.ts`

Backend: `owner`, `admin`, `manager`, `sales_rep`, `viewer`. Перевод в роли интерфейса — только в `uiRoleFromBackend`:

| Backend | Интерфейс | Статус |
|---------|-----------|--------|
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

### Сотрудники — `features/team`

`[{ id, name }]` — сотрудники в области видимости пользователя, для фильтров и выбора исполнителя.

### Продажи — `features/sales/schemas.ts`

- **Настройки воронок** `salesConfigSchema`: `pipelines: [{ id, name, stages: [{ id, name, kind: open|won|lost }] }]`, `lossReasons: [{ id, label }]`. Этапы и порядок задаёт компания; интерфейс не знает названий этапов.
- **Доска** `boardSchema`: `{ pipelineId, columns: [{ stageId, count, totalAmount, currency, deals[] }] }` — только рабочие этапы. `count` и `totalAmount` считает backend с учётом фильтров. Нужна ли подгрузка карточек колонки по `limit/offset` — уточнить.
- **Сделка** `dealSchema`: `id, title, client { name, phone }, pipelineId, stageId, amount, currency, manager { id, name }, nextAction { title, dueAt, isOverdue } | null, stageEnteredAt, updatedAt, tags[]`. Сделка = лид в воронке, открывается карточкой лида.
- **Таблица и «Список»**: тот же объект, `{ count, results }`; фильтры `pipeline_id` (необязателен — в «Списке» все воронки), `stage_id`, `manager_id`, `search`, «требует внимания» (`overdue` — следующий шаг просрочен, `no_next_step` — шага нет); сортировка `-updated` (по умолчанию), `updated`, `amount`, `-amount`, `next_action`, `title`. Имена параметров и полей сортировки — предложение.
- **Дата последней активности.** Сейчас «Обновлено» = `updatedAt`. Нужно ли отдельное поле `last_activity_at` (последний звонок, сообщение, встреча) — вопрос.
- **Смена этапа** (нужен endpoint): `stage_id`; при закрытии — `loss_reason_id` (обязателен для lost) и `comment`. Backend проверяет правила компании (успех только с оплатой) и возвращает обновлённую сделку или `validation_error`.

### Карточка лида — `features/leads/schemas.ts`

`leadDetailSchema`: `id, title, client { name, phones[], email, city }, pipeline { id, name, stages[] }, stageId, manager, amount, currency, source, createdAt, stageEnteredAt, tags[], nextAction, aiContext { summary, nextSteps[], generatedAt } | null, payment { total, paid, remaining, currency, items[{ id, kind: prepayment|additional|full, amount, paidDate }] } | null, customFields [{ id, label, value }], related [{ id, title, pipelineName, stageName }]`.

Отдельные запросы (каждая вкладка загружается независимо):
- **История** `[{ id, at, kind: call|chat|note|stage|task|meeting|payment, title, body, author }]`, новые сверху.
- **Звонки** `[{ id, at, direction, durationSec, manager, summary, transcript[{ speaker, text }] | null, rating { score 1–5, comment } | null }]`. **`rating` backend отдаёт только руководителям**; демо-слой повторяет это правило.
- Задачи и встречи лида — списки модулей «Задачи» и «Встречи» с фильтром `lead_id`.

Не хватает полей (нужно решение): **документы** (файлы, договоры), **переписка** (мессенджеры), **запись звонка** (ссылка на аудио и права на прослушивание), **редактирование полей** и схема настраиваемых полей компании (типы, обязательность), **история изменений этапов** с автором, **связанные контакты** (несколько людей у одной сделки).

### Задачи — `features/tasks/schemas.ts`

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
