# Состояние проекта — Инвентаризация студии

Актуально на: 2026-06-05

---

## Что это и зачем

Веб-система управления инвентарём студии Megapolis Media. Позволяет:
- Вести учёт всего оборудования, мебели и реквизита в реальном времени
- Закреплять технику за проектами и сотрудниками
- Видеть историю перемещений с привязкой к пользователю
- Контролировать расходные материалы
- В перспективе — синхронизироваться с 1С и корпоративной системой Nexus

**Стек:** React 18 + TypeScript + Vite + Ant Design 5  
**Бэкенд:** Self-hosted Supabase (inventory.megapolis.media) — PostgreSQL + Auth + Storage + Realtime  
**Деплой:** GitHub Pages → gurtsev.github.io/equipment-complect  
**Репозиторий:** github.com/Gurtsev/equipment-complect

---

## ✅ Реализовано

### Ядро системы
- Каталог оборудования: список и сетка карточек с переключателем
- Фильтры: по разделу (Техника / Мебель / Реквизит), категории, статусу, локации, помещению, отделу
- История перемещений с указанием пользователя, который внёс изменение
- Экспорт в CSV и Excel
- Печать карточки и QR-кода (открывает карточку по ссылке `?eq=EQP-####`)
- Мобильный адаптив

### Пользователи и доступ
- Авторизация: Supabase Auth (email + пароль, восстановление пароля)
- Роли: **admin** / **operator** / **viewer**
- Контроль доступа по отделу: оператор АХО не может редактировать технику студии
- Регистрация: только для email/доменов из таблицы `allowed_emails` (проверка через RPC до создания аккаунта)
- Защита мастер-аккаунта от смены роли (триггер в БД)
- Страница управления пользователями (только admin)

### Проекты
- Создание проектов с комплектами оборудования, датами и локацией
- Активация / завершение проекта с массовым обновлением статусов оборудования
- Блокировка занятого оборудования при добавлении в проект (date-based)
- История действий по проекту
- Календарный вид с цветными точками

### Сотрудники и займы
- Выдача оборудования сотруднику (`employee_assignments`) со статусом «Выдан»
- Карточка сотрудника: текущие выдачи, история, кнопка «Вернуть»
- Временные займы (`equipment_loans`): сотруднику или в другой отдел, с датой возврата
- Проверка незакрытого оборудования при увольнении (API для Nexus)

### Расходники
- Учёт позиций с остатком и порогом минимума
- Приход / расход / списание с историей
- Цветовая индикация: зелёный / жёлтый / красный
- Бейдж на вкладке при наличии критичных позиций

### Инфраструктура
- Self-hosted Supabase (перенесён из облака, 2026-06-04)
- Realtime: обновления у всех пользователей без перезагрузки (дебаунс 300 мс)
- GitHub Actions CI/CD: push в master → сборка → деплой на GitHub Pages
- Vitest тесты: diff-синхронизация project_equipment (5 тестов)

### Подготовка к интеграции с Nexus
- Переименование `profile_id → user_id` в `employee_assignments` (миграция 015)
- Добавлено поле `is_active` в `profiles` (миграция 015)
- Документ соглашений: `docs/integration-nexus.md`

---

## 🔧 Требует применения в БД

Миграции написаны, но могут быть ещё не применены на self-hosted:

```
015_integration_prep.sql   — profile_id→user_id, is_active в profiles
015_section_attributes.sql — поля section, attributes, quantity в equipment
```

Также создать вручную в Studio:
- Storage bucket `equipment-images` (Public)
- RPC-функция `is_email_allowed` (из LoginPage)
- Триггер `protect_master_admin`

---

## ⚠️ Известные проблемы

| Проблема | Статус |
|----------|--------|
| GitHub Pages не работает с self-hosted Supabase — нет SSL | Нужен HTTPS (Caddy/nginx + Let's Encrypt) |
| Фильтры сайдбара не применяются к сетке карточек | В работе |

---

## 📋 Что делать дальше

### Приоритет 1 — SSL для production
**Проблема:** GitHub Pages работает по HTTPS, self-hosted Supabase — по HTTP. Браузер блокирует запросы (Mixed Content).

**Решение:** настроить Caddy или nginx на сервере с Let's Encrypt:
```
inventory.megapolis.media  → Supabase API (порт 8000)
db.megapolis.media         → Supabase Studio (порт 3000)
```
После этого GitHub Pages будет полностью работать с self-hosted.

---

### Приоритет 2 — Фильтры сайдбара в режиме сетки
Сайдбар с фильтрами должен оставаться видимым в grid-режиме и передавать отфильтрованные элементы в сетку карточек.

---

### Приоритет 3 — Безопасность (4.11)

| # | Задача | Риск |
|---|--------|------|
| 1 | `profiles` RLS: viewer видит email и роли всех | 🔴 Высокий |
| 2 | Триггеры на `equipment_loans` и `employee_assignments`: проверять статус перед выдачей | 🔴 Высокий |
| 3 | Валидация файлов в форме оборудования (MIME-тип, max 10MB) | 🔴 Высокий |
| 4 | Race condition в consumables: `FOR UPDATE` в триггере | 🔴 Высокий |
| 5 | `allowed_emails` видны всем — ограничить до admin | 🟡 Средний |
| 6 | Тихие ошибки в EquipmentDetail (loadAssignment, loadLoan) | 🟡 Средний |
| 7 | Storage bucket: только operator+ может загружать файлы | 🟡 Средний |

---

### Приоритет 4 — Составные объекты (4.12)
Иерархия «родитель — компоненты» для ПК и других комплектов.

**Что нужно в БД:**
```sql
ALTER TABLE equipment ADD COLUMN parent_id uuid REFERENCES equipment(id);
ALTER TABLE equipment ADD COLUMN synced_with_1c boolean DEFAULT false;
CREATE TABLE pending_1c_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inv_number text NOT NULL UNIQUE,
  name_1c text NOT NULL,
  received_at timestamptz DEFAULT now(),
  matched_equipment_id uuid REFERENCES equipment(id)
);
```

**Новые статусы:** «Комплектуется», «Готов к сверке»

---

### Приоритет 5 — Интеграция с 1С (Этап 5)

**Условие запуска:** схема данных заморожена + весь инвентарь занесён в систему + QR-коды наклеены физически.

#### Процесс (описан в docs/process-1c-reconciliation.md):
1. Оборудование поступает → склад создаёт карточку без инвентарного номера
2. Бухгалтерия проводит в 1С → 1С автоматически передаёт номер в веб-сервис
3. Склад сверяет карточку: выбирает номер из выпадающего списка (pending_1c_items)
4. Веб-сервис отправляет серийный номер обратно в 1С
5. Для составных объектов — сводится только родительская карточка

#### Что нужно разработать:
- **Миграция:** `pending_1c_items`, `parent_id`, `synced_with_1c` в equipment
- **Edge Function** `receive-1c` — принимает данные из 1С (защищённый токен, не service_role)
- **Edge Function** `send-to-1c` — отправляет серийный номер обратно
- **UI:** выпадающий список несведённых номеров в поле «Инвентарный №»
- **Список «Ожидают сверки»** — карточки без инвентарного номера

---

### Приоритет 6 — Интеграция с Nexus (КСУ)

**Текущий статус:** Инвентаризация работает автономно. Nexus в разработке.  
**Документ соглашений:** `docs/integration-nexus.md`

#### Что сделано:
- ✅ `employee_assignments.profile_id → user_id` (миграция 015)
- ✅ `profiles.is_active` добавлен (миграция 015)

#### Что сделать при объединении:
- Создать схемы `nexus` и `shared` в PostgreSQL
- Создать `shared.users`, мигрировать данные Nexus
- Создать `VIEW public.profiles → shared.users` (код Инвентаризации не меняется)
- Обновить `current_user_role()` для маппинга `producer → operator`
- Перенести регистрацию в Nexus
- Настроить субдомены `hq.megapolis.media` и `db.megapolis.media`

---

## Архитектура БД (миграции)

| Файл | Что добавляет |
|------|--------------|
| 001 | equipment, equipment_history, projects, project_equipment |
| 002 | profiles, RLS политики |
| 003 | Storage bucket policies |
| 004 | allowed_emails, триггер handle_new_user |
| 005 | user_id в equipment_history |
| 006 | project_history |
| 007 | employee_assignments |
| 008 | department в equipment |
| 009 | department в profiles |
| 010 | consumables + consumable_transactions |
| 011 | equipment_loans |
| 012 | start_date в equipment_loans |
| 013 | rooms (иерархия помещений) |
| 014 | responsible в rooms |
| 015_section_attributes | section, attributes, quantity в equipment |
| 015_integration_prep | profile_id→user_id, is_active в profiles |
| — | **016** (план): pending_1c_items, parent_id, synced_with_1c |
