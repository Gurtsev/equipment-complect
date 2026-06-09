# Корпоративная SSO-архитектура Megapolis

## Принцип

Один аккаунт на всю компанию. Каждое приложение управляет своими правами независимо.

**Identity Provider:** Supabase Auth (self-hosted, офисный сервер)  
**Точка входа для сотрудника:** `nexus.megapolis.media` (Nexus)

---

## Субдомены

```
nexus.megapolis.media        → Nexus — операции, задачи, чат, HR
inventory.megapolis.media    → Инвентаризация — учёт оборудования
cloud.megapolis.media        → Облако — файловое хранилище
db.megapolis.media           → Supabase Studio (только офисная сеть / VPN)
```

---

## Как работает авторизация

```
1. Сотрудник логинится в Nexus (nexus.megapolis.media)
         ↓
2. Supabase Auth выдаёт JWT-токен
         ↓
3. Токен путешествует с пользователем
         ↓
4. Inventory / Cloud принимают тот же токен
   и валидируют через supabase.auth.getUser(token)
         ↓
5. Каждое приложение видит ФИО и должность из public.users
   и назначает свои внутренние права через своего админа
```

---

## Источник истины — `public.users`

Справочник сотрудников компании. Только идентификация — никаких прав приложений.

```sql
CREATE TABLE public.users (
  id          uuid PRIMARY KEY,  -- = auth.users.id из Supabase Auth
  email       text UNIQUE NOT NULL,
  name        text NOT NULL,
  position    text,              -- должность: 'видеооператор', 'HR' и т.д.
  department  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- Пишет **только Nexus**
- Читают все приложения
- `id` всегда равен `auth.users.id` — жёсткое правило

---

## Ролевые модели — полная изоляция

Nexus не знает какие роли есть в Inventory. Inventory не знает какие роли есть в Nexus.

```
public.users          →  только ФИО, должность, отдел
                               ↓                    ↓
                           Nexus              Inventory
                        свои роли            свои роли
                        свои права           свои права
                        свой админ           свой админ
```

Сотрудник приходит в приложение → приложение видит его ФИО и должность → **админ этого приложения** назначает ему роль и права внутри.

---

## Управление пользователями

- **Регистрация** — только через Nexus (по корпоративной почте)
- **Права в каждом приложении** — назначает мастер-админ этого приложения независимо
- **Бан в одном приложении** не влияет на доступ к другим

---

## Текущее состояние

| | Сейчас | Цель (Этап 2) |
|--|--------|----------------|
| Nexus auth | Supabase Auth ✅ | Supabase Auth ✅ |
| Inventory auth | Supabase Auth ✅ | Supabase Auth ✅ |
| Общий `public.users` | создан, ждёт деплоя | заполнен реальными данными |
| Единый токен | реализован, ждёт деплоя | да |

### Что нужно сделать (до Этапа 2)
- [x] Мигрировать авторизацию Nexus с `@fastify/jwt` на Supabase Auth
- [ ] Задеплоить Nexus на VDS (`nexus.knzteam.ru`)
- [ ] Задеплоить Инвентаризацию на VDS (`inventory.knzteam.ru`)
- [ ] Заполнить `public.users` после деплоя Nexus