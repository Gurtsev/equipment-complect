# Интеграция Nexus и Инвентаризации

Два приложения на одной инфраструктуре с общей базой данных пользователей.

---

## Принцип разделения (фундамент)

**Каждое приложение управляет своей ролевой моделью независимо.**

Nexus решает: кому показывать вкладку «Инвентаризация» — по роли, по отделу, по индивидуальному флагу. Это внутренняя задача Nexus.

Когда пользователь нажимает на вкладку и переходит в Инвентаризацию — он попадает в отдельную систему со своими правами. Какие у него там права — решает администратор Инвентаризации. Nexus в это не вмешивается.

```
Nexus:       своя ролевая модель → показывает/скрывает вкладку «Инвентаризация»
                                              ↓ переход
Инвентаризация:                    своя ролевая модель → admin | operator | viewer
```

Роли в `shared.users` — это роль человека в **компании**, не в конкретном приложении. Каждое приложение маппит их на свои внутренние права самостоятельно.

---

## Домены

```
hq.megapolis.media           → Nexus — корпоративная система управления
inventory.megapolis.media    → Инвентаризация — учёт оборудования
db.megapolis.media           → Supabase Studio (только из офиса / VPN)
```

---

## Целевая инфраструктура

```
Офисный сервер
└── Self-hosted Supabase (один инстанс)
    ├── Supabase Auth       ← единые аккаунты для обоих приложений
    ├── PostgREST           ← добавить nexus в db-extra-search-path
    ├── Supabase Studio     ← db.megapolis.media
    └── PostgreSQL
        ├── schema: public  ← Инвентаризация (как есть)
        ├── schema: nexus   ← Nexus
        └── schema: shared  ← общие: пользователи, клиенты
```

---

## Два этапа — чёткое разделение

### Этап 1. Автономная работа (сейчас)

Инвентаризация деплоится и работает самостоятельно. Nexus в разработке.

**Инвентаризация сохраняет полностью:**
- Свою форму регистрации и механизм `allowed_emails`
- Свою ролевую модель `admin | operator | viewer`
- Свою таблицу `profiles` как есть
- Всё, что сейчас работает — не трогать

**Инвентаризация делает только это** (минимальная подготовка к будущей интеграции):
```sql
-- 1. Переименовать поле (соглашение об именовании) ✅ СДЕЛАНО (миграция 015)
ALTER TABLE employee_assignments RENAME COLUMN profile_id TO user_id;

-- 2. Добавить поля для совместимости ✅ СДЕЛАНО (миграция 015)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
```

**Nexus делает сейчас:**
- Завершает разработку
- Приводит модель `User` к структуре `shared.users` (см. ниже)
- Деплоится на свой VDS для тестирования

---

### Этап 2. Объединение (когда оба готовы)

Оба приложения переезжают на офисный сервер в один Supabase-инстанс.

```
Шаги объединения:
1. Создать schema: nexus и schema: shared
2. Добавить nexus в PostgREST db-extra-search-path
3. Создать shared.users
4. Nexus мигрирует свои users → shared.users
5. Инвентаризация создаёт VIEW public.profiles → shared.users (код не меняется)
6. Supabase Auth становится единым для обоих
7. Регистрация переходит в Nexus, форма в Инвентаризации убирается
8. allowed_emails переезжает в shared или удаляется
```

---

## Целевая модель: `shared.users`

К этой структуре готовятся оба приложения — каждое независимо, без спешки.

```sql
CREATE TABLE shared.users (
  id          uuid PRIMARY KEY,  -- = auth.users.id из Supabase Auth
  email       text UNIQUE NOT NULL,
  name        text NOT NULL,
  role        text NOT NULL,     -- 'admin' | 'producer' | 'user' | 'freelancer'
  department  text,              -- может быть NULL; значения не меняются
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

---

## Маппинг ролей

Роли в `shared.users` — это уровень компании. Каждое приложение интерпретирует их само:

| `shared.users.role` | Nexus | Инвентаризация |
|---------------------|-------|----------------|
| `admin` | полный доступ | = admin |
| `producer` | продюсер | = operator (редактирование оборудования) |
| `user` | сотрудник | = viewer (только чтение) |
| `freelancer` | внешний подрядчик | только своя история |

**Важно:** До объединения Инвентаризация использует `admin | operator | viewer` как есть.
После объединения — RLS-функции `current_user_role()` обновить для маппинга `producer → operator`.

---

## Фрилансеры

Хранятся в `shared.users` с `role = 'freelancer'`. Создаются только через Nexus:
```
→ supabase.auth.admin.createUser({ email, email_confirm: true })  -- аккаунт без пароля
→ INSERT INTO shared.users (id = auth.uid, role = 'freelancer', ...)
→ Когда нужен доступ — resetPasswordForEmail()
```

До объединения неактуально.

---

## Миграция profiles → shared.users без переписывания кода

При объединении создаётся VIEW:

```sql
CREATE VIEW public.profiles AS
SELECT id, email, name, role, department, is_active, created_at
FROM shared.users;
```

`current_user_role()`, `current_user_department()`, все сервисы — не меняются.

---

## Проверка оборудования при увольнении (из Nexus)

```sql
SELECT ea.* FROM public.employee_assignments ea
WHERE ea.user_id = $1
  AND ea.returned_at IS NULL
```

---

## Соглашение об именовании

| Что | Формат | Пример |
|-----|--------|--------|
| Таблицы | snake_case, множественное число | `employee_assignments` |
| Ссылка на пользователя | `user_id` | `employee_assignments.user_id` |
| Первичные ключи | `id uuid` | |
| Дата создания | `created_at timestamptz` | |
| Булевы флаги | `is_*` | `is_active` |

---

## Чеклист

### Инвентаризация (Этап 1)
- [x] `ALTER TABLE employee_assignments RENAME COLUMN profile_id TO user_id` — миграция 015
- [x] Добавить `is_active` в `profiles` — миграция 015

### При объединении (Этап 2)
- [ ] Создать схемы `nexus` и `shared`, настроить PostgREST
- [ ] Создать `shared.users`, мигрировать данные Nexus
- [ ] Создать `VIEW public.profiles → shared.users`
- [ ] Обновить `current_user_role()` для маппинга `producer → operator`
- [ ] Перенести регистрацию в Nexus, убрать форму из Инвентаризации
- [ ] Настроить субдомены `hq.megapolis.media` и `db.megapolis.media`
