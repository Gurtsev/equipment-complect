# План: Nexus как точка входа SSO + гейт видимости («заглушка»)

> **Дата:** 2026-06-09
> **Ветка:** `feat/supabase-sso-gate` (от `rebuild-v3`)
> **Сверено с:** [`INTEGRATION.md`](./INTEGRATION.md), [`SSO-ARCHITECTURE.md`](./SSO-ARCHITECTURE.md), [`VDS-SETUP.md`](./VDS-SETUP.md)

---

## 1. Цель

Задеплоить Nexus на общий сервер **уже сейчас**, чтобы:
- сотрудники могли логиниться под своей корпоративной почтой;
- обычный пользователь видел **пустой кабинет с единственной кнопкой «Перейти в Инвентаризацию»** — и только если админ (ты) ему это разрешил;
- реальные люди попадали в общий **`public.users`**, откуда их читает Инвентаризация;
- коллега задеплоил Инвентаризацию рядом и работал на реальных общих таблицах.

Полный функционал Nexus (календари, проекты, задачи) **не удаляется** — он остаётся в коде и виден **только админу**, пока механика дорабатывается.

Этот план — конкретная реализация шага из [`INTEGRATION.md`](./INTEGRATION.md) §«Этап 1 / Nexus»: _привести `User` к `public.users` + мигрировать авторизацию с `@fastify/jwt` на Supabase Auth + задеплоить на VDS_.

---

## 2. Объём: две «ноги»

### Нога A — строится сейчас (сторона Nexus, self-contained)
1. Логин и онбординг через **Supabase Auth** (общий инстанс на VDS).
2. Запись людей в общий **`public.users`**.
3. **Гейт видимости:** админ → весь апп; обычный юзер → пустой кабинет + кнопка (по флагу).
4. Ручной онбординг: админ привязывает почту → создаётся Supabase-аккаунт + строка в `public.users`.

### Нога B — отложено (зависит от коллеги)
Фактический вход в Инвентаризацию по клику (приземление залогиненным). Требует:
- задеплоенной `inventory.knzteam.ru`;
- согласованного контракта передачи токена (см. §8).

До Ноги B кнопка ведёт на адрес Инвентаризации, но «бесшовный вход» дорабатывается, когда коллега поднимет приложение.

---

## 3. Домены

Деплой идёт на **прод VDS `knzteam.ru`** (`147.45.97.124`). Домен `megapolis.media` подключим позже — только поменяем env-переменные. Маппинг доменов из `SSO-ARCHITECTURE.md` сохраняется, меняется только зона:

| Роль | Тест (сейчас) | Прод (потом) |
|------|---------------|--------------|
| Nexus | `nexus.knzteam.ru` | `nexus.megapolis.media` |
| Инвентаризация | `inventory.knzteam.ru` | `inventory.megapolis.media` |
| Supabase Studio | `db.knzteam.ru` | `db.megapolis.media` |
| Supabase API (Kong) | **нужно завести** (см. §9) | — |

---

## 4. Фундамент авторизации (Supabase Auth)

Соответствует `SSO-ARCHITECTURE.md` §«Как работает авторизация»: **IdP = Supabase Auth**, Nexus — точка входа.

**Фронтенд:**
- `@supabase/supabase-js` (`SUPABASE_URL` + `ANON_KEY`).
- Логин — `signInWithPassword({ email, password })` → Supabase-сессия (access + refresh JWT), хранится клиентом.
- Рефреш токена делает сам supabase-js — собственный `/auth/refresh` больше не нужен.
- Первый вход — задание пароля по ссылке на почту (см. §6).

**Бэкенд:**
- Supabase подписывает JWT алгоритмом **HS256 тем же `JWT_SECRET`**. → Nexus указывает в `@fastify/jwt` **тот же `JWT_SECRET`, что и Supabase**, и валидирует токены почти без переделки.
- Из токена берём `sub` = `auth.uid`. **Важно:** в Supabase-JWT нашего `admin` нет (claim `role` там = Postgres-роль `authenticated`). Поэтому `authenticate` после верификации токена подгружает запись `nexus.users` по `authId = sub` и кладёт в `request` флаги `isAdmin` / `canAccessInventory`. `requireRole('admin')` проверяет `nexus.users.isAdmin`, а не claim из токена.
- Серверные admin-операции (создание пользователей) — через `SERVICE_ROLE_KEY` (только на сервере, никогда в браузер).

**Что уходит:**
- `POST /auth/login` (bcrypt), `POST /auth/refresh`, поле `passwordHash`.
- `impersonate` для админа — **сохраняем** (полезно для отладки); детали реализации поверх Supabase обсудим на этапе плана.

---

## 5. Модель данных

### `public.users` (общий, пишет только Nexus)
Точно по `SSO-ARCHITECTURE.md` — **только идентичность, без ролей**:

```sql
public.users (
  id          uuid PRIMARY KEY,   -- = auth.users.id
  email       text UNIQUE NOT NULL,
  name        text NOT NULL,
  position    text,               -- должность
  department  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
)
```
Строка появляется **только когда человек получил почту/аккаунт**.

### `nexus.users` (внутренняя — текущая Prisma-модель `User`)
Остаётся справочником **всех** сотрудников и фрилансеров (ФИО/должности уже загружены). Правки:

| Поле | Действие | Зачем |
|------|----------|-------|
| `passwordHash` | **удалить** | пароли теперь в Supabase |
| `email` | сделать **nullable** | у справочных записей без аккаунта почты ещё нет |
| `authId` (uuid, nullable, unique) | **добавить** | связь с Supabase-аккаунтом и с `public.users.id` |
| `canAccessInventory` (boolean, default false) | **добавить** | ручной флаг доступа в Инвентаризацию; **ролевую модель НЕ вводим** |

- FK-связи (проекты, задачи, чаты) остаются на `nexus.users.id` — его не трогаем; связь с auth идёт через `authId`.
- `userType` (`staff`/`freelancer`) и `position` уже есть — используются как есть. У фрилансеров `position` маппится в `public.users.position` (ср. `INTEGRATION.md` §«Фрилансеры»).

### Prisma multiSchema
Включить preview-фичу `multiSchema`. Все существующие модели аннотировать `@@schema("nexus")`, добавить модель `PublicUser` c `@@schema("public")`. `nexus_role` уже имеет полный доступ к обеим схемам (см. `VDS-SETUP.md`).

---

## 6. Онбординг пользователя (ручной режим)

```
Сотрудники/фрилансеры (ФИО, должность) уже в nexus.users, без email/authId
        ↓  админ открывает карточку человека и вводит корп-почту
1. Бэкенд (SERVICE_ROLE_KEY): supabase.auth.admin.createUser({ email, email_confirm: true })  → auth.uid
2. INSERT public.users (id=auth.uid, email, name, position, department, is_active=true)
3. UPDATE nexus.users SET authId=auth.uid, email=<почта> WHERE id=<сотрудник>
4. Отправить ссылку на задание пароля: supabase.auth.resetPasswordForEmail(email)
        ↓  пользователь задаёт пароль и входит (signInWithPassword)
5. Админ отдельно тыкает canAccessInventory, когда готов дать доступ
```

- Массового импорта почт нет (их пока нет) — онбординг постепенный, по мере выдачи почт.
- Идемпотентность: повторная привязка той же почты не создаёт дубль (проверка `authId`/`email`).

---

## 7. Гейт видимости

### Фронтенд
- После логина `GET /auth/me` → `{ id, name, position, isAdmin, canAccessInventory }`.
- `isAdmin === true` → рендер **полного `AppShell`** (текущая навигация: календарь, проекты, задачи и т.д.).
- иначе → **`PersonalCabinetPage`** (новый, минимальный):
  - приветствие + ФИО/должность;
  - если `canAccessInventory` → одна кнопка **«Перейти в Инвентаризацию»**;
  - иначе → empty-state: «Доступ к приложениям пока не назначен. Обратитесь к администратору.»

### Бэкенд (важно — гейт обязан быть и на сервере)
На время заглушки **все «фичевые» роуты** (`/projects`, `/work-items`, `/tasks`, `/tracks`, `/events`, `/calendar-entries`, `/clients`, `/structure`, `/chats`, `/database`) переводятся на `requireRole('admin')`. Не-админ физически не получает данные, даже если подменит фронт.
- Исключения, доступные любому аутентифицированному: `GET /auth/me` и эндпоинт хендоффа (§8).
- Когда механика будет готова — гарды ослабляются точечно под реальную видимость.

### Управление флагом
Тоггл `canAccessInventory` — в существующей админ-странице `PersonnelPage` (она уже admin-only). Плюс там же поле «корп-почта» с кнопкой «Создать аккаунт» (запускает §6).

---

## 8. Передача в Инвентаризацию (Нога B)

Соответствует `SSO-ARCHITECTURE.md` §«Как работает авторизация» (шаги 3–4): токен путешествует с пользователем, Инвентаризация валидирует его через `supabase.auth.getUser(token)`.

**Механизм (рекомендуемый) — передача Supabase-сессии между сабдоменами:**
1. Клик → фронт Nexus берёт текущую сессию (`access_token` + `refresh_token`).
2. Редирект на `https://inventory.knzteam.ru/#access_token=...&refresh_token=...`.
3. Инвентаризация читает fragment → `supabase.auth.setSession(...)` → пользователь залогинен (тот же Supabase-проект, токен валиден).
4. Первый вход в Инвентаризацию → её сторона заводит свой профиль/роль (её админ раздаёт права — Nexus не вмешивается).

**Альтернатива:** хранение Supabase-сессии в cookie на родительском домене `.knzteam.ru` (обе апки настроены на cookie-storage) — бесшовно, но требует согласованной настройки обеих сторон.

**Контракт, который надо согласовать с коллегой:**
- способ передачи токена (fragment vs общий cookie);
- точный redirect URL и обработка на стороне Инвентаризации;
- что Инвентаризация принимает нашу Supabase-сессию и создаёт профиль при первом входе.

До согласования и деплоя Инвентаризации — кнопка просто ведёт на `https://inventory.knzteam.ru`.

---

## 9. Инфра-задачи

1. **Публичный Supabase-эндпоинт для браузера.** Сейчас через NPM проксируются только `db` и `tv` (`VDS-SETUP.md`). Браузерному supabase-js нужен публичный URL Kong (`:8000`). Завести Proxy Host, напр. `api.knzteam.ru → kong:8000` (или `auth.knzteam.ru`), SSL Let's Encrypt. `SUPABASE_URL` = этот адрес.
2. **RLS на `public.users`.** Supabase PostgREST по умолчанию отдаёт схему `public` под `anon`-ключом. Включить **RLS на `public.users` с deny-by-default**, чтобы анонимный браузерный ключ не мог вычитать справочник. (Nexus пишет/читает через `nexus_role` напрямую — RLS его не ограничивает; Инвентаризация — через `inventory_role`/VIEW.)
3. **Деплой Nexus на `nexus.knzteam.ru`** (по чеклисту `VDS-SETUP.md` §Nexus):
   - `git clone`, ветка `feat/supabase-sso-gate`;
   - `.env`: `DATABASE_URL=postgresql://nexus_role:...@localhost:5432/postgres`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET=<тот же, что у Supabase>`, `WEB_URL=https://nexus.knzteam.ru`;
   - `prisma migrate deploy` (создаёт таблицы в `nexus` + `public.users`);
   - docker compose up;
   - Proxy Host `nexus.knzteam.ru → nexus-app:4000`, SSL.

---

## 10. Миграция существующих данных

- **Существующие `users`.** Текущая таблица требует `email` (unique, NOT NULL) и `passwordHash` (NOT NULL). Миграция: drop `passwordHash`, `email` → nullable. Если ФИО загружены с placeholder-почтами — обнулить их (оставить реальные при наличии).
- **Админ.** Аккаунт админа (`admin@tvshifts.ru`) онбордится через Supabase **первым** (§6), `isAdmin=true`, `authId` проставляется. Без рабочего Supabase-аккаунта админ не войдёт.
- **Порядок на VDS:** миграции Prisma → создать `public.users` (+RLS) → онбординг админа → проверка входа → онбординг первых пользователей.

---

## 11. Сверка с опорными документами

| Требование | Источник | Как покрыто |
|------------|----------|-------------|
| IdP = Supabase Auth, Nexus — точка входа | SSO §«Как работает авторизация» | §4 |
| `public.users` = идентичность без ролей (`position`, не `role`) | SSO §«Источник истины», INTEGRATION §1 | §5 |
| `id = auth.uid` — жёсткое правило | SSO §«Источник истины» | §5, §6 |
| Роли изолированы по приложениям, Инвентаризация раздаёт свои | SSO §«Ролевые модели», INTEGRATION §«Принцип» | §7, §8 |
| Регистрация только через Nexus | SSO §«Управление пользователями» | §6 |
| Фрилансеры: `position`, аккаунт через admin API | INTEGRATION §2 | §5, §6 |
| Схемы `public`/`nexus`/`inventory`, роли БД | INTEGRATION §«Схемы», VDS-SETUP | §5, §9 |
| Этап 1 Nexus: User→public.users + Supabase Auth + деплой VDS | INTEGRATION §«Этап 1» | весь документ |

---

## 12. Открытые вопросы / зависимости

- **Контракт хендоффа** (§8) — согласовать с коллегой; блокирует только Ногу B.
- **Деплой Инвентаризации** на `inventory.knzteam.ru` — на стороне коллеги.
- **Где взять реальные корп-почты** — запросить список; влияет на скорость онбординга, не на код.
- **Способ задания пароля** — ссылка на почту (`resetPasswordForEmail`) vs временный пароль. План по умолчанию — ссылка на почту.

---

## 13. Не входит в объём (YAGNI)

- Ролевая модель / RBAC / таблица `permissions` — только булев флаг `canAccessInventory`.
- Самостоятельная регистрация и белый список почт — онбординг ручной.
- Перенос на прод `megapolis.media` — сейчас только тестовый `knzteam.ru`.
- Бесшовный SSO в Облако/Плеер — вне текущей задачи.
- Перевыпуск/ротация секретов Facecast (отдельная заметка по безопасности).
