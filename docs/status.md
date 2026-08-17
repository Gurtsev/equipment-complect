# Состояние проекта — Инвентаризация студии

Актуально на: 2026-08-17

> Документ проходит актуализацию после быстрого развития проекта. Текущие решения
> имеют приоритет над историческими разделами ниже: `CLAUDE.md`, миграции БД и
> `docs/decisions/`.

---

## Что это и зачем

Веб-система управления инвентарём студии Megapolis Media. Позволяет:
- Вести учёт всего оборудования, мебели и реквизита в реальном времени
- Закреплять технику за проектами и сотрудниками
- Видеть историю перемещений с привязкой к пользователю
- Контролировать расходные материалы
- В перспективе — синхронизироваться с 1С и корпоративной системой Nexus

**Стек:** React 18 + TypeScript + Vite + Ant Design 5  
**Бэкенд:** Self-hosted Supabase — PostgreSQL + Auth + Storage + Realtime
**Деплой:** Docker (`nginx:alpine`) через GitHub Actions на `https://inventory.knzteam.ru`
**Репозиторий:** github.com/Gurtsev/equipment-complect

---

## ✅ Реализовано

### Ядро системы
- Каталог оборудования: сетка карточек (только grid-режим, список убран), фильтрация через боковую панель / drawer на мобайле
- Фильтры: по разделу (Техника / Мебель / Реквизит), категории, статусу, локации и помещению
- История перемещений с указанием пользователя, который внёс изменение
- Экспорт в CSV и Excel
- Печать карточки и QR-кода (открывает карточку по ссылке `?eq=EQP-####`)
- Мобильный адаптив

### Пользователи и доступ
- Авторизация: единый SSO через Nexus и Supabase Auth
- Роли: **admin** / **operator** / **viewer**
- Отделы в Inventory удалены миграцией 021; operator редактирует весь инвентарь
- Профиль SSO-пользователя до объединения справочников создаётся с ролью viewer
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
- Временные займы (`equipment_loans`) сотруднику с датой возврата
- Проверка незакрытого оборудования при увольнении (API для Nexus)

### Расходники
- Учёт позиций с остатком и порогом минимума
- Приход / расход / списание с историей
- Цветовая индикация: зелёный / жёлтый / красный
- Бейдж на вкладке при наличии критичных позиций

### Инфраструктура
- Self-hosted Supabase (перенесён из облака, 2026-06-04)
- Realtime: обновления у всех пользователей без перезагрузки (дебаунс 300 мс)
- GitHub Actions CI/CD: quality gate → immutable Docker image по commit SHA → production VDS → HTTP smoke-check
- Vitest: 10 тестов сервисной логики
- Процесс выпуска и отката: `docs/release-process.md`

### Корзина и списки-шаблоны
- Архитектура: Корзина → переиспользуемый Список → импорт в Проект
- DB: `carts`, `cart_items`, `equipment_lists`, `equipment_list_items`, `loan_conflict_events` (миграция 018)
- DB: `date → timestamptz` для `projects` и `equipment_loans`, DateTimePicker с шагом 15 мин (миграция 017)
- Сервисы `cartService`, `listService`; компоненты `CartDrawer`, `ListsPage` (вкладка «Списки», только canEdit)
- Кнопка «В корзину» на карточках оборудования и в списке каталога
- Иконка корзины с бейджем в хедере
- Проект наполняется из списка с предварительным сравнением позиций и проверкой конфликтов
- Повторный импорт добавляет только новые доступные позиции; состав проекта и список после импорта независимы
- Решение: `docs/decisions/001-reusable-equipment-list-templates.md`

### Подготовка к интеграции с Nexus
- Переименование `profile_id → user_id` в `employee_assignments` (миграция 015)
- Добавлено поле `is_active` в `profiles` (миграция 015)
- Документ соглашений: `docs/integration-nexus.md`

---

## 🔧 Требует применения в БД

Перед выкладкой текущего frontend требуется применить:

```
024_project_list_templates.sql — переиспользуемые списки и история импорта
025_reconcile_realtime_publication.sql — сверка Realtime publication со frontend
```

Порядок применения и проверки: `docs/deploy-024-project-list-templates.md`.

---

## ⚠️ Известные проблемы

| Проблема | Статус |
|----------|--------|
| GitHub Pages не работает с self-hosted Supabase — нет SSL | Нужен HTTPS (Caddy/nginx + Let's Encrypt) |

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

### Приоритет 2 — Безопасность (4.11)

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

### Приоритет 3 — Составные объекты (4.12, нужен для 1С)
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

### Приоритет 4 — Интеграция с 1С (Этап 5)

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

### Приоритет 5 — Интеграция с Nexus (КСУ)

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
| 015_integration_prep | profile_id→user_id, is_active в profiles |
| 016_section_attributes | section, attributes, quantity в equipment |
| 017_datetime_precision | date→timestamptz для projects и equipment_loans |
| 018_cart_and_lists | carts, cart_items, equipment_lists, equipment_list_items, loan_conflict_events |
| 019_profiles_rls_fix | ограничение чтения профилей |
| 020_profile_names_function | безопасная выдача имён профилей |
| 021_remove_departments | удаление отделов и межотдельских займов |
| 022_inv_number_nullable | nullable инвентарный номер до сверки с 1С |
| 023_composite_equipment | составные объекты оборудования |
| 024_project_list_templates | списки-шаблоны и история импорта в проект |
| 025_reconcile_realtime_publication | идемпотентный Realtime-контракт таблиц frontend |
