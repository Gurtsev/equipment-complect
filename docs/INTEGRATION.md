# Интеграция Nexus и Инвентаризации

Два приложения на одной инфраструктуре с общей базой данных пользователей.

---

## 📊 Статус на 2026-06-09 (обновлено после деплоя Nexus)

**Nexus развёрнут на проде и работает end-to-end.** Что сделано сегодня:

- ✅ **Миграция `sso_multischema` применена на проде.** Была в состоянии failed (роль `postgres` в Supabase не суперюзер → не могла создать схему). Починили: выдали `postgres` через `supabase_admin` права `CREATE ON DATABASE` + членство в `nexus_role`, перезапустили api — миграция прошла. Все 23 таблицы приложения переехали в схему `nexus`, `public.users` создана.
- ✅ **Авторизация на Supabase Auth** работает: вход → JWT → Nexus резолвит юзера по `auth_id`, права по `nexus.users.isAdmin`.
- ✅ **TLS для `auth.knzteam.ru` настроен в NPM** (его не хватало: Proxy Host → `supabase-kong:8000`, Let's Encrypt). Без него логин был невозможен.
- ✅ **Контейнеры `nexus-api` / `nexus-web` — Up**, вход админом проверен в браузере.
- ✅ **Админ Nexus заведён правильно**: `auth.users` + `public.users` (id = auth.uid) + `nexus.users` (isAdmin) — все три связаны.

**Что подтвердилось про контракт:**
- Inventory логинится через общий `auth.users` (Supabase Auth) и ведёт свою `inventory.profiles` — **`public.users` сейчас НЕ использует**. Единственное общее на данный момент — `auth.users` (единый вход).
- `public.users` уже существует (целевая модель), но как **общий справочник** заработает только когда Inventory сделает свою часть Этапа 2 (profiles → VIEW над `public.users`).

**⚠️ Отклонение от плана:** на проде `DATABASE_URL` у Nexus = роль `postgres` (а не `nexus_role`, как в плане). Причина: `nexus_role` не имеет `CREATE ON DATABASE`, не может прогонять миграции со схемами. Для чистой изоляции на уровне БД нужно либо выдать `nexus_role` право создавать схемы, либо разделить миграционную и рантайм-роли. На изоляцию **прикладных** ролей не влияет.

**⚠️ К объединению (для Inventory):** сейчас триггер `handle_new_user` создаёт `inventory.profiles` на **каждый** новый `auth.users` → Nexus-only юзеры протекают в список inventory. На Этапе 2 заменяется на VIEW над `public.users` (только сотрудники компании).

---

### Статус Инвентаризации (обновлено 2026-06-10)

**Этап 1 завершён, приложение в проде.**
- ✅ Чистый передеплой в схему `inventory` (миграции 001–020, `combined_001_020.sql`)
- ✅ PostgREST `db-schemas = inventory, public` настроен и проверен (curl)
- ✅ Ручные объекты пересозданы: `inventory.is_email_allowed`, `protect_master_admin`, bucket `equipment-images`
- ✅ Деплой: `https://inventory.knzteam.ru` (Docker + nginx + GitHub Actions CD на том же VDS)
- ✅ Тестовый admin-аккаунт создан, вход проверен
- ✅ SSO Шаг 1 готов: `detectSessionInUrl`/`persistSession` в `supabase.ts` подхватывают токены из URL-хеша, `fetchOrCreateProfile` авто-создаёт профиль `viewer` для SSO-юзеров

- ✅ Чтение `public.users` проверено (PostgREST + anon key, `Accept-Profile: public`) — 3 записи доступны

**Не сделано / ждём:**
- ⏳ SSO Шаг 2: редирект на портал Nexus при отсутствии сессии + удаление формы логина/регистрации
- ⏳ Этап 2: `profiles` → VIEW над `public.users` + `user_roles` (учесть несовпадение значений `department`)

---

### Как Nexus заводит пользователей (онбординг)
1. Импорт из Google Sheets (страница «База данных») создаёт профили в `nexus.users` (читает A:E листа `MAIN 2`; email **не** тянется — генерится плейсхолдер, потом обнуляется).
2. Реальную рабочую почту админ вписывает **вручную** в карточке сотрудника (поле Email → Сохранить).
3. Кнопка **«Выдать доступ в систему»** (`POST /auth/onboard/:id`) создаёт `auth.users` с **временным паролем** (возвращается админу один раз) + строку в `public.users` (`id = auth.uid`) + связывает `auth_id`. Пароль админ передаёт сотруднику лично (SMTP не нужен).
4. Пока email пустой — кнопка «Выдать доступ» заблокирована (нельзя онбордить без реальной почты).

Саморегистрации в Nexus нет — только админ-онбординг. Это и есть «единая точка регистрации».

---

## ✅ Деплой на прод VDS — ВЫПОЛНЕНО (2026-06-09)

**Сервер:** `147.45.97.124` / `knzteam.ru` (домен временный, потом сменим на `megapolis.media`)
**Supabase:** уже запущен, Kong доступен через `auth.knzteam.ru`
**DB Studio:** `db.knzteam.ru` → логин из `.env`: `PROD_COLLEAGUE_STUDIO_USER` / `PROD_COLLEAGUE_STUDIO_PASSWORD`

---

### Nexus — что делаем мы

- [x] **1. Добавить GitHub Secrets** (github.com → репо → Settings → Secrets → Actions):
  - `VDS_SSH_KEY` — приватный SSH-ключ для `root@147.45.97.124`
  - `SUPABASE_ANON_KEY` — значение из `PROD_SUPABASE_ANON_KEY` в `.env`
  _(деплой прошёл → секреты заданы)_

- [x] **2. Подготовить VDS** (один раз, по SSH: `ssh root@147.45.97.124`):
  ```bash
  # Docker-сеть для NPM
  docker network create web_proxy

  # Клонировать репо
  git clone https://github.com/knyazzer/PlanOtchetGlot.git ~/nexus
  ```

- [x] **3. Создать `~/nexus/.env` на VDS:** _(создан; `DATABASE_URL` сейчас на роли `postgres` — см. отклонение в статусе вверху)_
  ```env
  # Реальные значения — в docs/CREDENTIALS.md (gitignored). Здесь только плейсхолдеры.
  DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@supabase-db:5432/postgres
  JWT_SECRET=<JWT_SECRET — общий с Supabase>
  NODE_ENV=production
  PORT=4000
  WEB_URL=https://nexus.knzteam.ru
  SUPABASE_URL=https://auth.knzteam.ru
  SUPABASE_SERVICE_ROLE_KEY=<из PROD_SUPABASE_SERVICE_ROLE_KEY>
  ```

- [x] **4. Обновить NPM прокси** `nexus.knzteam.ru` → `nexus-web:80` _(Online)_. Также добавлен `auth.knzteam.ru` → `supabase-kong:8000` (его не хватало для логина).

- [x] **5. Запустить деплой** — `git push origin master`, CD собрал образы и развернул на VDS.

- [x] **6. Проверить** — `https://nexus.knzteam.ru` открывается, вход админом работает.

- [x] **7. ~~Заполнить `public.users` массово~~ — не нужно.** Онбординг (`POST /auth/onboard`) пишет `public.users` с правильным `id = auth.uid`. Массовый INSERT с `gen_random_uuid()` (как было задумано) дал бы неверные id — **не использовать**. Пользователи заводятся через онбординг.

---

### Инвентаризация — что делает коллега

- [x] **1. Получить от вас:**
  - `PROD_COLLEAGUE_STUDIO_USER` / `PROD_COLLEAGUE_STUDIO_PASSWORD` — получено, доступ к Studio есть
  - Отдельный `PROD_INVENTORY_DATABASE_URL` не понадобился — фронтенд SPA подключается через `VITE_SUPABASE_URL=https://auth.knzteam.ru` + `VITE_SUPABASE_ANON_KEY` (PostgREST/Auth API), без прямого `DATABASE_URL`

- [x] **2. `.env` настроен** _(адаптировано под SPA: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` вместо `DATABASE_URL`, см. п.1)_

- [x] **3. Переехали все таблицы из `public` → схему `inventory`** — чистый передеплой выполнен, миграции 001–020 прогнаны (`combined_001_020.sql`)

- [x] **4. PostgREST настроен**:
  ```toml
  db-schemas = "inventory, public"
  ```
  Контейнер `supabase-rest` перезапущен (`docker compose up -d rest`), проверено через curl.

- [x] **5. Проверить доступ к `public.users`** — проверено 2026-06-10 через PostgREST (`Accept-Profile: public`, anon key): вернулись все 3 записи (`v.gerwald`, `m.gurtsev`, `o.belozerov`). Доступ работает.
  > ⚠️ Замечено для Этапа 2: значения `department` в `public.users` не везде из набора `studio|aho|office` (у Белозерова — `"Бренд медиа департамент"`). Учесть при миграции `current_user_department()`.

- [x] **6. Приложение задеплоено**: `https://inventory.knzteam.ru` (временный домен, переедет на `inventory.megapolis.media`). CD: GitHub Actions → GHCR → SSH на тот же VDS, Docker + nginx.

---

### Синхронизация данных пользователей

После того как оба приложения задеплоены:

```
Nexus пишет → public.users (id, email, name, position, department, is_active)
                    ↓
Инвентаризация читает → public.users (только SELECT через inventory_role)
```

Коллега **не пишет** в `public.users` — только читает. Nexus — единственный источник данных о сотрудниках.

---

---

## Принцип разделения (фундамент)

**Каждое приложение управляет своей ролевой моделью независимо.**

Nexus решает: кому показывать вкладку «Инвентаризация» — по своей внутренней ролевой модели. Это внутренняя задача Nexus.

Когда пользователь нажимает на вкладку и переходит в Инвентаризацию — он попадает в отдельную систему со своими правами. Какие у него там права — решает администратор Инвентаризации. Nexus в это не вмешивается.

```
Nexus:       своя ролевая модель → показывает/скрывает вкладку «Инвентаризация»
                                              ↓ переход
Инвентаризация:                    своя ролевая модель → admin | operator | viewer
```

`public.users` — это справочник сотрудников компании. Ролевые модели каждого приложения полностью изолированы друг от друга.

---

## Домены

```
nexus.megapolis.media        → Nexus — корпоративная система управления
inventory.megapolis.media    → Инвентаризация — учёт оборудования
db.megapolis.media           → Supabase Studio (только из офиса / VPN)
```

`db.megapolis.media` — только внутренняя DNS запись, снаружи недоступен.

---

## Инфраструктура сервера

### Физический сервер

```
Офисный сервер
├── Облако компании
├── Nexus (наше приложение)
├── Инвентаризация (приложение коллеги)
└── Другие сервисы
```

**Ресурсы выделенные нашим приложениям:** 4 ядра + 15 ГБ RAM (Nexus + Инвентаризация вместе).

### Reverse proxy — Вариант А (выбран)

Отдельная машина в локальной сети с **nginx proxy manager**:

```
Интернет → Reverse proxy машина (nginx proxy manager)
               ├── nexus.megapolis.media        → Nexus
               ├── inventory.megapolis.media    → Инвентаризация
               └── [другие субдомены]           → другие сервисы
```

- SSL сертификаты — автоматически через Let's Encrypt для каждого субдомена
- Настраивает администратор сервера
- Нужно: любая машина с Ubuntu, подключённая в локальную сеть

### Self-hosted Supabase

```
Офисный сервер
└── Self-hosted Supabase (один инстанс)
    ├── PostgreSQL          ← база данных (работает независимо от приложений)
    ├── Supabase Auth       ← авторизация, единая для обоих приложений
    ├── PostgREST           ← REST API из таблиц
    ├── Realtime            ← WebSocket подписки
    ├── Storage             ← файлы
    └── Studio              ← db.megapolis.media (только офисная сеть)
```

Оба приложения подключаются **напрямую к PostgreSQL** — мимо друг друга. Если Nexus выключен, Инвентаризация продолжает работать и наоборот.

---

## Схемы и права доступа

**Архитектура подтверждена** (2026-06-08): данные Инвентаризации тестовые → коллега делает чистый передеплой с переезом в схему `inventory`. `public` становится нейтральной территорией только для общих данных.

```
PostgreSQL
├── schema: public     ← только общие данные (users — доступны обоим)
├── schema: nexus      ← только Nexus (tasks, tracks, chats, events...)
└── schema: inventory  ← только Инвентаризация (equipment, assignments...)
```

### Что хранится в каждой схеме

| Схема | Таблицы | Пишет | Читает |
|-------|---------|-------|--------|
| `public` | users | **только Nexus** | оба |
| `nexus` | tasks, tracks, chats, events, calendar, departments | **только Nexus** | **только Nexus** |
| `inventory` | equipment, employee_assignments, consumable_transactions, profiles | **только Инвентаризация** | **только Инвентаризация** |

### Роли PostgreSQL

Каждое приложение подключается под своим пользователем БД:

```
nexus_role      → полный доступ к nexus.*
                → полный доступ к public.* (пишет users, читает всё)
                → нет доступа к inventory.*

inventory_role  → полный доступ к inventory.*
                → только чтение из public.* (читает users)
                → нет доступа к nexus.*
```

```
Nexus:      DATABASE_URL = postgresql://nexus_role:pass@server/db
Inventory:  DATABASE_URL = postgresql://inventory_role:pass@server/db
```

Единственный общий канал — `public.*`. Приватные схемы (`nexus.*` и `inventory.*`) закрыты друг от друга.

### Что нужно от Инвентаризации — переезд в `inventory`

Данные тестовые → чистый передеплой (не живая миграция):

1. В ~20 файлах миграций: `CREATE TABLE xxx` → `CREATE TABLE inventory.xxx`
2. В ~11 функциях (`current_user_role`, `handle_new_user`, триггеры): `public.xxx` → `inventory.xxx`, добавить `SET search_path = inventory, public`
3. PostgREST: `db-schemas = inventory, public` + рестарт
4. Realtime: добавить `inventory` в публикацию `supabase_realtime`
5. Фронтенд: `db: { schema: 'inventory' }` в `supabase.ts`
6. Очистить БД → прогнать миграции заново → заново завести тестовые данные

### Кто управляет правами

Суперадмин PostgreSQL (владелец сервера) — настраивает роли при объединении. После настройки каждый работает в своих границах.

---

## Два этапа — чёткое разделение

### Этап 1. Автономная работа (сейчас)

Каждое приложение работает самостоятельно и готовится к будущему объединению.

**Инвентаризация:**
- Сохраняет свою форму регистрации и `allowed_emails`
- Сохраняет ролевую модель `admin | operator | viewer`
- ✅ Переименовала `profile_id → user_id` в `employee_assignments` (миграция 015)
- ✅ Добавила `is_active` в `profiles` (миграция 015)
- 🔄 Переезжает все таблицы из `public` → схема `inventory` (чистый передеплой, данные тестовые)

**Nexus:**
- Завершает разработку
- Приводит модель `User` к структуре `public.users` (см. ниже)
- Мигрирует авторизацию с `@fastify/jwt` на Supabase Auth
- Деплоится на свой VDS для тестирования

---

### Этап 2. Объединение (когда оба готовы)

Оба приложения переезжают на офисный сервер в один Supabase-инстанс.

```
Шаги объединения:
1. Создать schema: nexus и schema: inventory в общем Supabase
2. Настроить PostgREST: db-schemas = public, inventory + рестарт
3. Создать public.users (целевая модель, см. ниже)
4. Nexus мигрирует свои users → public.users
5. Инвентаризация создаёт VIEW inventory.profiles = public.users JOIN inventory.user_roles (роли — отдельно, см. handoff внизу; код не меняется)
6. Supabase Auth становится единым для обоих
7. Регистрация переходит в Nexus, форма в Инвентаризации убирается
8. allowed_emails переезжает в Nexus или удаляется
9. Настроить роли PostgreSQL: nexus_role / inventory_role
```

> ⚠️ **Порядок миграции `profiles`:** от `inventory.profiles` зависит `VIEW inventory.profile_names` (миграция 019 — безопасное чтение `id, name` без email/role). Правильный порядок: `DROP VIEW profile_names` → пересоздать `profiles` как VIEW над `public.users` → пересоздать `profile_names` поверх неё.

---

## Целевая модель: `public.users`

К этой структуре готовятся оба приложения — каждое независимо, без спешки.

```sql
CREATE TABLE public.users (
  id          uuid PRIMARY KEY,  -- = auth.users.id из Supabase Auth
  email       text UNIQUE NOT NULL,
  name        text NOT NULL,
  position    text,              -- должность: 'видеооператор', 'HR' и т.д.
  department  text,              -- может быть NULL; значения не меняются
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

---

## Ответы на вопросы по интеграции

### 1. Ролевые модели — изоляция

Nexus не знает какие роли есть в Inventory. Inventory не знает какие роли есть в Nexus.

`public.users` содержит только должность (`position`) и отдел (`department`) сотрудника. Права внутри каждого приложения назначает администратор этого приложения независимо.

```
public.users (ФИО, должность, отдел)
        ↓                      ↓
    Nexus                  Inventory
  свои роли               свои роли
  свой админ              свой админ
```

---

### 2. Фрилансеры без auth.users

Правило `id = auth.uid` остаётся жёстким. Фрилансеры получают auth-аккаунт без пароля:

```
Nexus создаёт фрилансера:
→ supabase.auth.admin.createUser({ email, email_confirm: true })
  — аккаунт существует, войти нельзя
→ INSERT INTO public.users (id = auth.uid, position = 'freelancer', ...)
→ Когда фрилансеру нужен доступ — resetPasswordForEmail()
```

До объединения этот вопрос неактуален — фрилансеры создаются только в Nexus.

---

### 3. Регистрация

**Сейчас:** Инвентаризация сохраняет форму регистрации и `allowed_emails` полностью.

**При объединении:** форма регистрации в Инвентаризации убирается, остаётся только логин. `allowed_emails` переезжает в Nexus или удаляется.

---

### 4. Department — конфликт типов

Значения `studio | aho | office` не меняются. В `public.users` поле `department` — `text`, валидация на уровне приложения. RLS-функции `current_user_department()` продолжают работать с теми же строками.

---

### 5. Миграция profiles → public.users без переписывания кода

> ⚠️ **Уточнено 2026-06-09 (см. актуальный handoff внизу).** Простой `VIEW … FROM public.users` **НЕ подходит** — в `public.users` нет колонки `role`, и `admin/operator/viewer` потеряются. Роли надо вынести в отдельную таблицу `inventory.user_roles`, а VIEW собрать как `public.users` JOIN `user_roles`. Точная миграция — в разделе «🔧 Этап 2 — актуальный handoff» в конце файла.

При объединении `inventory.profiles` становится VIEW над `public.users` (+ JOIN ролей). Колонки 1:1 с прежней таблицей, поэтому `current_user_role()`, `current_user_department()`, `usersService`, `assignmentService` и остальные **не меняются**.

---

## Проверка оборудования при увольнении (из Nexus)

Когда сотрудник увольняется, Nexus может проверить незданное оборудование через read-доступ к `inventory`:

```sql
SELECT ea.* FROM inventory.employee_assignments ea
WHERE ea.user_id = $1
  AND ea.returned_at IS NULL
```

---

## Соглашение об именовании (для совместимости)

| Что | Формат | Пример |
|-----|--------|--------|
| Таблицы | snake_case, множественное число | `employee_assignments` |
| Ссылка на пользователя | `user_id` | `employee_assignments.user_id` |
| Первичные ключи | `id uuid` | |
| Дата создания | `created_at timestamptz` | |
| Булевы флаги | `is_*` | `is_active` |

---

## Итоговый чеклист

### Инвентаризация (Этап 1) — ✅ ЗАВЕРШЁН (2026-06-10)
- [x] `ALTER TABLE employee_assignments RENAME COLUMN profile_id TO user_id` — миграция 015
- [x] Добавить `is_active` в `profiles` — миграция 015
- [x] Переписать миграции: все 27 объектов `public.xxx` → `inventory.xxx` (20 файлов)
- [x] Обновить функции: `set search_path = inventory, public` в 5 функциях
- [x] Фронтенд: `db: { schema: 'inventory' }` в `supabase.ts`
- [x] Realtime: все 10 таблиц квалифицированы как `inventory.*`
- [x] PostgREST: `db-schemas = inventory, public` — настроено, контейнер перезапущен, проверено curl
- [x] Чистый передеплой: БД очищена, миграции 001–020 прогнаны (`combined_001_020.sql`)
- [x] Пересоздать ручные объекты: `inventory.is_email_allowed`, `protect_master_admin`, bucket `equipment-images`
- [x] Завести тестовые данные: первый admin-аккаунт создан, вход проверен
- [x] Задеплоено: `https://inventory.knzteam.ru` (Docker + nginx + GitHub Actions CD)
- [x] SSO Шаг 1: `detectSessionInUrl`/`persistSession` + авто-создание профиля для SSO-юзеров

### Nexus (Этап 1) — ✅ ЗАВЕРШЁН (2026-06-09)
- [x] `fullName → name`, `dept → department` в Prisma-схеме и коде
- [x] Применить миграцию — применена на проде (см. статус вверху)
- [x] Мигрировать авторизацию с `@fastify/jwt` на Supabase Auth — сделано, вход проверен
- [x] Деплой на VDS — развёрнут, логин админом работает

### При объединении (Этап 2)
- [ ] Создать схемы `nexus` и `inventory` в общем Supabase, настроить PostgREST
- [ ] Создать `public.users`, мигрировать данные Nexus
- [ ] Создать `VIEW inventory.profiles → public.users`
  - ⚠️ Сначала `DROP VIEW profile_names` → пересоздать `profiles` как VIEW → пересоздать `profile_names` поверх неё
- [ ] Настроить роли PostgreSQL: `nexus_role`, `inventory_role`
- [ ] Перенести регистрацию в Nexus, убрать форму из Инвентаризации
- [ ] Настроить субдомены `nexus.megapolis.media` и `db.megapolis.media`

---

## 🔧 Этап 2 — актуальный handoff для Инвентаризации (2026-06-09)

Сверено с живой БД на проде. Реальная структура `inventory.profiles`:
`id (uuid), name, role, email, department, is_active`.

### Что уже сделано на стороне Nexus (предусловия)
- ✅ `public.users` создана (целевая модель: `id, email, name, position, department, is_active, created_at`).
- ✅ В `public.users` заведены сотрудники с `id = auth.uid` (`v.gerwald`, `m.gurtsev`).
- ✅ `inventory_role` получил `USAGE` на схему `public` и `SELECT` на `public.users`.

### ⚠️ Главный нюанс: роли не помещаются в `public.users`
`public.users` хранит только идентичность (имя/должность/отдел) — **поля `role` там нет**. Поэтому простой `VIEW profiles AS SELECT ... FROM public.users` **потеряет** `admin/operator/viewer`. Роли надо вынести в отдельную таблицу Инвентаризации.

### Рекомендуемая миграция (на стороне Инвентаризации)
```sql
-- 1. Роли — в отдельную таблицу (их нет в public.users)
CREATE TABLE inventory.user_roles (
  user_id uuid PRIMARY KEY,
  role    text NOT NULL DEFAULT 'viewer'  -- admin | operator | viewer
);
INSERT INTO inventory.user_roles (user_id, role)
SELECT id, role FROM inventory.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 2. profiles → VIEW над public.users (колонки 1:1 с прежней таблицей, код не меняется)
DROP VIEW IF EXISTS inventory.profile_names;        -- зависит от profiles (миграция 019)
ALTER TABLE inventory.profiles RENAME TO profiles_old;  -- бэкап старой таблицы
CREATE VIEW inventory.profiles AS
  SELECT pu.id, pu.name, ur.role, pu.email, pu.department, pu.is_active
  FROM public.users pu
  JOIN inventory.user_roles ur ON ur.user_id = pu.id;
CREATE VIEW inventory.profile_names AS SELECT id, name FROM inventory.profiles;
```

### Следствия (важно для кода Инвентаризации)
- **VIEW не записываемый.** Код, писавший в `profiles` (регистрация, апдейт `is_active`/`name`), надо перенаправить: идентичность (`name/email/department/is_active`) — в `public.users` (управляет Nexus), `role` — в `inventory.user_roles`. Либо `INSTEAD OF`-триггеры на VIEW.
- **Доступ становится явным.** Человек виден в Инвентаризации, только если есть строка в `user_roles`. Это **убирает текущую протечку** «любой `@megapolis.media` → авто-профиль с ролью admin».
- **Убрать триггер `handle_new_user`** (авто-создание профиля на каждый `auth.users`) и **форму регистрации + `allowed_emails`** — регистрация переходит в Nexus.
- `current_user_role()` и пр. продолжают работать, т.к. VIEW отдаёт те же колонки (включая `role`).

### Что Инвентаризация получает от Nexus
- Право `SELECT` на `public.users` (уже выдано).
- Гарантию, что все нужные сотрудники есть в `public.users` с `id = auth.uid`.
- Новых сотрудников Nexus заводит сам (auth.users + public.users) — Инвентаризация только назначает им роль в `inventory.user_roles`.

---

## 🔐 Единый вход (SSO) — решение 2026-06-09

**Цель:** единая точка входа = **Nexus как портал авторизации**. Регистрация и логин — только в Nexus. Inventory свою форму логина/регистрации убирает.

### Поток
```
Пользователь открывает inventory.knzteam.ru
   → сессии нет → redirect на портал Nexus:
       https://nexus.knzteam.ru/login?redirect=https://inventory.knzteam.ru
   → вход в Nexus (общий auth.users)
   → Nexus проверяет: пользователь зарегистрирован? (есть в auth.users/public.users)
       да  → redirect обратно на inventory с токенами в хеше (#access_token=…&refresh_token=…)
   → inventory поднимает сессию из хеша и пускает
```

**Принцип:** портал проверяет только **факт регистрации** (можно ли вообще войти). А **права внутри** каждого приложения раздаёт само приложение: Nexus — по `nexus.users` (isAdmin/role), Inventory — по `inventory.user_roles` (admin/operator/viewer). Портал в права приложений не вмешивается.

### Что нужно сделать Инвентаризации

**Шаг 1 (минимум, бесшовный переход из Nexus уже сейчас):** принимать токены из URL-хеша при загрузке —
```js
const h = new URLSearchParams(window.location.hash.slice(1))
const at = h.get('access_token'), rt = h.get('refresh_token')
if (at && rt) {
  await supabase.auth.setSession({ access_token: at, refresh_token: rt })
  history.replaceState(null, '', window.location.pathname)  // очистить хеш
}
```
Тогда кнопка «Перейти в Инвентаризацию» из Nexus → вход без повторной формы.

**Шаг 2 (полный портал):**
- при отсутствии сессии — `redirect` на `https://nexus.knzteam.ru/login?redirect=<свой_url>` вместо своей формы;
- **убрать свою форму логина/регистрации** (вкладка «Зарегистрироваться» уходит — регистрация только в Nexus).

### На стороне Nexus — ✅ СДЕЛАНО и задеплоено (2026-06-09)
- ✅ `/login?redirect=…`: после входа отдаёт сессию на `redirect` через URL-хеш (`#access_token=…&refresh_token=…`). Проверено: переход на `inventory.knzteam.ru` с токенами работает.
- ✅ Whitelist доменов для redirect: `*.knzteam.ru` и `*.megapolis.media` (защита от open-redirect) — `apps/web/src/lib/sso.ts`.
- ✅ Уже залогиненного пользователя с `?redirect=` сразу перенаправляет (без повторного входа).
- `auth.knzteam.ru` остаётся **API** (Kong/GoTrue) — это не страница входа; страница входа = Nexus.
- Ограничение домена на форме входа **не делаем**: в Nexus нет саморегистрации (только админ-онбординг), форма лишь логинит уже заведённых.

> **Осталось только на стороне Инвентаризации** — Шаги 1-2 выше (принять токены из хеша + редирект на портал + убрать форму). После этого SSO полностью бесшовный.

### На стороне Инвентаризации — статус (2026-06-10)
- ✅ Шаг 1 проверен на проде: переход из Nexus в Inventory с токенами в хеше подхватывает сессию без повторного входа.
- ✅ Шаг 2 реализован: своя форма логина/регистрации удалена (`LoginPage` удалён), при отсутствии сессии — редирект на `https://nexus.knzteam.ru/login?redirect=<url>`. `signIn`/`signUp`/`forgotPassword` убраны из `AuthContext`. SSO теперь полностью бесшовный.
- ⏳ Не убраны из БД: `allowed_emails`, триггер `handle_new_user` — остаются как часть Этапа 2 (профили → VIEW над `public.users`).
