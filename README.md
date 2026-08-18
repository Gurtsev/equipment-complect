# Equipment Complect

Внутренняя система учёта оборудования, мебели, реквизита и расходных материалов
Megapolis Media. Приложение ведёт текущее состояние и историю имущества, помогает
собирать комплекты для проектов и отслеживать выдачу сотрудникам.

Production: `https://inventory.knzteam.ru`

## Возможности

- каталог с поиском, фильтрами, сеткой карточек и Excel/CSV-экспортом;
- карточка оборудования, фотографии, QR-коды и история перемещений;
- проекты: бронирование, выдача, возврат, календарь и история действий;
- корзина и переиспользуемые списки-шаблоны для наполнения проектов;
- постоянные назначения и временные займы сотрудникам;
- составные объекты: родительская карточка и компоненты;
- помещения с иерархией и ответственными;
- учёт расходников и операций прихода/расхода/списания;
- роли `admin`, `operator`, `viewer` и единый вход через Nexus;
- Supabase Realtime для синхронизации открытых приложений.

## Архитектура

- React 18, TypeScript, Vite и Ant Design 5;
- self-hosted Supabase: PostgreSQL, Auth, Storage и Realtime;
- все прикладные таблицы находятся в PostgreSQL-схеме `inventory`;
- frontend обращается к БД через сервисы из `src/services`;
- атомарность и права доступа должны обеспечиваться SQL/RLS, а внешние секреты —
  серверными функциями;
- production представляет собой статическую Vite-сборку в `nginx:alpine`.

## Локальный запуск

Требования: Node.js 20 и npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev -- --host
```

В `.env` необходимо указать:

```dotenv
VITE_SUPABASE_URL=https://your-supabase-url.example
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Anon key попадает в клиентскую сборку по назначению. `service_role`, пароли 1С и
прочие серверные секреты запрещено хранить в `VITE_*` переменных.

## Проверки

```powershell
npm run typecheck       # TypeScript
npm run test:run        # Vitest, один прогон
npm run check           # typecheck + тесты + проверка combined SQL
npm run build           # production-сборка + бюджет стартового JS (300 КБ gzip)
```

Перед коммитом также выполняется `git diff --check`. Полный порядок выпуска:
[docs/release-process.md](docs/release-process.md).

## База данных

Последовательные миграции находятся в `supabase/migrations`. Уже применённые
миграции не редактируются: любое изменение получает следующий номер.

Для чистой БД используется автоматически сформированный файл:

```powershell
npm run db:combine
```

Команда создаёт актуальный `supabase/combined_001_XXX.sql`. Ручное редактирование
combined-файла запрещено; `npm run check` контролирует его соответствие исходным
миграциям.

Текущий статус применения миграций на production перечислен в
[docs/status.md](docs/status.md).

## Основная структура

```text
src/
  components/       UI по функциональным областям
  contexts/         SSO-сессия и роли
  models/           модели Equipment и Project
  services/         доступ к Supabase и предметные операции
supabase/
  migrations/       последовательная схема БД
docs/
  decisions/        архитектурные решения (ADR)
  INTEGRATION.md     интеграция с Nexus
  status.md          фактическое состояние и ближайшие работы
ROADMAP.md           этапы развития
CHANGELOG.md         пользовательские изменения
```

## Поставка

Push в `master` запускает GitHub Actions:

1. typecheck, тесты и проверку generated SQL;
2. сборку Docker image с тегами `latest` и commit SHA;
3. развёртывание immutable SHA-образа на production VDS;
4. HTTP smoke-check production.

Изменения схемы применяются отдельно по инструкции конкретной миграции. Frontend
должен сохранять совместимость на время rolling deploy.

## Документация

- [Текущее состояние](docs/status.md)
- [Roadmap](ROADMAP.md)
- [Архитектурные решения](docs/decisions/)
- [Интеграция Nexus](docs/INTEGRATION.md)
- [Процесс сверки с 1С](docs/process-1c-reconciliation.md)
- [ТЗ для интегратора 1С](docs/tz-1c-integrator.md)
- [Changelog](CHANGELOG.md)
