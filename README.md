# CRM — frontend

Frontend CRM для управления результативностью отдела продаж. Backend — отдельный Python-сервис.

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

Откройте http://localhost:3000. По умолчанию интерфейс работает на демо-данных (метка «Демо-данные» в шапке).

Чтобы посмотреть интерфейс глазами другой роли, задайте `NEXT_PUBLIC_DEMO_ROLE` в `.env.local` (`director`, `head_of_sales`, `manager`) и перезапустите `npm run dev`.

## Проверки

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Документация

- [docs/PRODUCT.md](docs/PRODUCT.md) — продукт, роли, принятые решения и открытые вопросы
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — структура проекта и правила модулей
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — токены, типографика, состояния, компоненты
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — взаимодействие с Python backend и несогласованные контракты
- [docs/DECISIONS.md](docs/DECISIONS.md) — журнал решений
- [CLAUDE.md](CLAUDE.md) — правила работы для ИИ-ассистента
