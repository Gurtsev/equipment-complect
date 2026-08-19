# Состояние проекта — Инвентаризация студии

Актуально на: 2026-08-18

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
- Deep links оборудования и помещений валидируются; при конфликте параметров приоритет имеет `eq`
- Supabase-запросы frontend используют явные списки полей без `SELECT *`
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
- Vitest: 48 тестов сервисной логики
- Процесс выпуска и отката: `docs/release-process.md`

### Корзина и списки-шаблоны
- Архитектура: Корзина → переиспользуемый Список → импорт в Проект
- DB: `carts`, `cart_items`, `equipment_lists`, `equipment_list_items`, `loan_conflict_events` (миграция 018)
- DB: `date → timestamptz` для `projects` и `equipment_loans`, DateTimePicker с шагом 15 мин (миграция 017)
- Сервисы `cartService`, `listService`; компоненты `CartDrawer`, `ListsPage` (вкладка «Списки», только canEdit)
- Кнопка «В корзину» на карточках оборудования и в списке каталога
- Иконка корзины с бейджем в хедере
- Проект наполняется из списка с предварительным сравнением позиций и проверкой конфликтов
- Карточка проекта явно показывает ошибку истории; picker и импорт не открываются без успешной проверки займов
- Повторный импорт добавляет только новые доступные позиции; состав проекта и список после импорта независимы
- Решение: `docs/decisions/001-reusable-equipment-list-templates.md`

### Подготовка к интеграции с Nexus
- Переименование `profile_id → user_id` в `employee_assignments` (миграция 015)
- Добавлено поле `is_active` в `profiles` (миграция 015)
- Документ соглашений: `docs/integration-nexus.md`

---

## ✅ Состояние production DB

По подтверждению владельца проекта 2026-08-18 на production применены:

```
024_project_list_templates.sql — переиспользуемые списки и история импорта
025_reconcile_realtime_publication.sql — сверка Realtime publication со frontend
026_storage_and_allowlist_security.sql — права Storage и приватность allowlist
027_consumables_stock_integrity.sql — атомарные изменения остатков расходников
028_equipment_custody_integrity.sql — серверная целостность выдач и займов
029_atomic_custody_operations.sql — транзакционные выдачи/возвраты вместе с историей
030_atomic_project_save.sql — атомарный жизненный цикл проекта и серверные конфликты
```

Порядок применения списков и Realtime: `docs/deploy-024-project-list-templates.md`.
Настройка и проверка Storage: `docs/storage-security.md`.
Проверка и применение ограничений целостности: `docs/deploy-027-029-integrity.md`.
Атомарное сохранение проектов: `docs/deploy-030-atomic-project-save.md`.

Поля `project_history` из миграции 024 дополнительно подтверждены через production
PostgREST OpenAPI. RPC миграций 029–030 корректно скрыты от роли `anon`; их
authenticated smoke-check выполняется через пользовательские сценарии.
Frontend считает эти RPC обязательным production-контрактом и не откатывается
к неатомарным клиентским запросам при ошибке schema cache.
Расширенные поля `project_history` из 024 также считаются обязательными.
Прямых frontend-записей в `project_history` нет: аудит формируют RPC в той же
транзакции, что и основное изменение.

Миграция `031_atomic_equipment_create.sql` применена на production.
Frontend создаёт карточку оборудования и первую запись истории одним
вызовом `create_equipment_with_history`; legacy-вставок нет.

Миграция `032_atomic_assembly_status.sql` применена на production.
Frontend меняет `assembly_status` и добавляет запись истории одним вызовом
`set_equipment_assembly_status`; legacy-последовательности из двух запросов нет.

---

## ⚠️ Известные проблемы

| Проблема | Статус |
|----------|--------|
| Стартовый frontend bundle | ✅ ~260 КБ gzip после lazy loading; build-бюджет 300 КБ |
| Authenticated smoke-check RPC 029–030 после миграции | Проверить выдачу/возврат и полный жизненный цикл тестового проекта через UI |

---

## 📋 Что делать дальше

### Приоритет 1 — Безопасность и целостность (4.11)

| # | Задача | Риск |
|---|--------|------|
| 1 | `profiles` RLS: viewer видит только свой профиль | ✅ Миграции 019–020 |
| 2 | Серверная целостность `equipment_loans` и `employee_assignments` | ✅ Миграция 028 |
| 3 | Валидация файлов (image/*, max 10 МБ) | ✅ Реализовано, проверить bucket |
| 4 | Race condition в consumables: блокировка и запрет частичного списания | ✅ Миграция 027 |
| 5 | `allowed_emails` доступны только admin | ✅ Миграция 026 |
| 6 | Тихие ошибки в EquipmentDetail (loadAssignment, loadLoan) | ✅ Исправлено |
| 7 | Storage bucket: запись только operator+ | ✅ Миграция 026 |

---

### Приоритет 3 — Составные объекты (4.12, нужен для 1С)

Иерархия «родитель — компоненты» уже реализована миграцией 023: `parent_id text`,
`assembly_status`, UI сборки и статусы «Комплектуется»/«Готов к сверке». Для
этапа 5 остаётся спроектировать очередь `pending_1c_items` и серверный контракт
сверки; эти сущности нельзя добавлять до согласования формата обмена с 1С.

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
| 026_storage_and_allowlist_security | Storage только operator+, allowlist только admin |
| 027_consumables_stock_integrity | блокировка остатка и атомарный отказ при недостатке расходника |
| 028_equipment_custody_integrity | взаимное исключение выдач и займов, контроль пересечения периодов |
| 029_atomic_custody_operations | атомарные выдачи, займы, возвраты и история оборудования |
| 030_atomic_project_save | атомарный жизненный цикл проекта, состав, статусы и аудит |
| 031_atomic_equipment_create | атомарное создание карточки оборудования и начальной истории |
| 032_atomic_assembly_status | атомарная смена статуса сборки и запись истории |
