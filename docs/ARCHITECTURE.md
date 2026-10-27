# Архитектура frontend

Стек: Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui (стиль base-nova на Base UI), Lucide, Zod, Recharts (через shadcn chart).
Backend — отдельный Python-сервис. Next.js не содержит API-маршрутов и бизнес-логики backend.

## Структура

```
app/                         Только маршруты и сборка страниц
  layout.tsx                 Шрифты, тема, метаданные
  error.tsx, not-found.tsx   Ошибка каркаса и 404
  (crm)/                     Группа маршрутов с каркасом (меню + шапка)
    layout.tsx               Получает пользователя, рисует AppSidebar и AppHeader
    loading.tsx, error.tsx   Загрузка и ошибка страницы внутри каркаса
    dashboard/page.tsx       Главная: заголовок + DashboardGrid по раскладке
    deals/ contacts/ …       Разделы «в разработке» (UpcomingSection)

features/                    Бизнес-модули
  dashboard/
    index.ts                 Публичный API модуля
    schemas.ts               Zod-схемы данных главной (предложение контракта)
    api/dashboard-repository.ts   Источник данных: демо или HTTP
    lib/                     Расчёты: темп плана, узкое место воронки
    components/              Виджеты и их части
    widget-registry.tsx      Тип виджета → компонент, заголовок, скелетон, право
  tasks/                     Задачи: схема, репозиторий, виджет «Задачи на сегодня»
  workspace/                 Схема раскладки, шаблоны по ролям, репозиторий раскладок

components/
  ui/                        shadcn-примитивы (генерируются CLI, без бизнес-логики)
  layout/                    Каркас: AppSidebar, AppHeader
  shared/                    Переиспользуемые блоки: PageHeader, WidgetCard, EmptyState,
                             ErrorState, StatusBadge, TrendIndicator, WidgetErrorBoundary,
                             UpcomingSection

config/                      env (проверка zod), site, locale, routes, navigation
lib/
  api/                       client.ts — единственная точка HTTP; errors.ts — типы ошибок
  permissions/roles.ts       Роли, права, hasPermission (только для отображения)
  session/current-user.ts    Текущий пользователь (демо, пока нет авторизации)
  format.ts                  Деньги, проценты, даты в локали компании
mocks/                       ДЕМО-ДАННЫЕ. Импортируются только из mock-репозиториев
hooks/                       Общие клиентские хуки
docs/                        Документация проекта
```

Модули `deals`, `contacts`, `calls`, `meetings`, `analytics` получат папки в `features/`, когда в них появится код. Пустые заготовки не создаём.

## Правила зависимостей

- Направление импортов: `app → features → components / config / lib`. Обратных импортов нет.
- Модуль импортирует другой модуль только через его `index.ts`. Исключение — главная: это модуль-агрегатор, и она берёт виджеты из публичного API других модулей.
- В `components/ui` нет бизнес-логики. Переиспользуемые блоки лежат в `components/shared`, блоки конкретного модуля — в `features/*/components`.
- `mocks/` импортируют только mock-реализации репозиториев.
- Переменные окружения читаются только в `config/env.ts`.

## Данные и backend

Каждый модуль описывает свой репозиторий — тип с методами, например `DashboardRepository`. У репозитория две реализации:

- **mock** берёт данные из `mocks/`, проверяет их теми же Zod-схемами и добавляет задержку, чтобы были видны состояния загрузки;
- **http** вызывает `apiRequest()` из `lib/api/client.ts`. Пока контракт не согласован, метод выбрасывает `ApiError("contract_pending")` и ничего не выдумывает.

Реализацию выбирает `NEXT_PUBLIC_DATA_SOURCE` (`mock` или `api`). Виджеты не знают, откуда пришли данные.

`apiRequest()` проверяет каждый ответ Zod-схемой и превращает HTTP-ошибки в `ApiError` с типом: network, unauthorized, forbidden, validation, not_found, server, invalid_response, contract_pending.

## Рендеринг и состояния

- Страницы и виджеты по умолчанию — Server Components. Клиентские компоненты только там, где они нужны: меню (активный пункт), шапка, график, границы ошибок.
- Включены Cache Components: главная собирается как статический каркас, а каждый виджет подгружается отдельно (Partial Prerender).
- Каждый виджет главной обёрнут в `WidgetErrorBoundary` (`catchError` из `next/error`) и `<Suspense>` со скелетоном. Медленный или упавший виджет не блокирует остальные.
- Ошибка страницы обрабатывается в `app/(crm)/error.tsx` (меню остаётся доступным), ошибка каркаса — в `app/error.tsx`.

## Рабочие пространства

- `features/workspace/schemas.ts` — схема раскладки: список виджетов с типом и размером (`third`, `half`, `two-thirds`, `full`).
- `default-layouts.ts` — шаблоны платформы по ролям: руководитель и менеджер.
- `widget-registry.tsx` — явный список допустимых виджетов. Раскладка не может сослаться на произвольный код.
- `DashboardGrid` отрисовывает раскладку и отфильтровывает виджеты, на которые у роли нет права.

Позже раскладка будет приходить с backend на уровне компании, отдела и пользователя и проверяться той же схемой.

## Проверки

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Vitest и Playwright будут подключены вместе с первыми бизнес-сценариями: формами и правами.
