# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studio equipment inventory management SPA built with React 18 + TypeScript + Vite + Ant Design 5. Navigation header with tabs at the top; sidebar (Каталог / Проекты) on the left appears only for those two tabs; detail panel on the right. Backend: Supabase (PostgreSQL + Storage + Auth + Realtime).

## Development Commands

```powershell
npm run dev -- --host   # dev server со всеми сетевыми интерфейсами (нужно при VPN)
npm run build           # tsc + vite build
npm run preview         # preview production build
```

Требует `.env` с `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`. См. `.env.example`.

**VPN:** `localhost` не работает при включённом VPN. Запускать с `--host`, открывать по адресу из строки `Network:` (обычно `192.168.x.x:5173`). QUIC нужно отключить в Chrome: `chrome://flags/#enable-quic` → Disabled.

## Architecture

```
src/
  services/
    supabase.ts               # createClient() с 15-секундным таймаутом на fetch
    equipmentService.ts       # CRUD для таблицы equipment + equipment_history
    historyService.ts         # INSERT в equipment_history
    projectService.ts         # CRUD для таблицы projects + project_equipment
    projectHistoryService.ts  # Лог действий по проекту (project_history)
    assignmentService.ts      # Выдача оборудования сотруднику (employee_assignments)
    loanService.ts            # Временные займы между отделами (equipment_loans)
    consumablesService.ts     # Расходные материалы + транзакции
    roomService.ts            # Помещения: дерево, ответственный, утилиты buildRoomTree/getRoomPath
    usersService.ts           # profiles + allowed_emails CRUD
    cartService.ts            # Корзина (carts + cart_items) — одна на пользователя
    listService.ts            # Списки оборудования (equipment_lists + equipment_list_items)
  contexts/
    AuthContext.tsx            # AuthProvider, useAuth hook, роли пользователя
  models/
    Equipment.ts              # Equipment class + TypeScript types
    Project.ts                # Project class + ProjectStatus type
  components/
    CatalogSidebar/           # Вкладка «Каталог»: поиск, фильтры, список, экспорт
    ProjectsSidebar/          # Вкладка «Проекты»: список проектов со статусами
    EquipmentDetail/          # Правая панель: карточка оборудования
    ProjectDetail/            # Правая панель: карточка проекта
    Dashboard/                # Правая панель по умолчанию: сводная статистика
    CreateEquipmentDrawer/    # Drawer: создание и редактирование оборудования
    CreateProjectDrawer/      # Drawer: создание и редактирование проекта
    CalendarView/             # Полноширинная вкладка: Ant Design Calendar с проектами
    ConsumablesPage/          # Полноширинная вкладка: расходники + транзакции
    RoomsPage/                # Полноширинная вкладка: дерево помещений + QR
    ListsPage/                # Полноширинная вкладка: списки оборудования (только canEdit)
    EmployeeCard/             # Drawer из UsersPage: выданное оборудование сотрудника
    UsersPage/                # Вкладка «Пользователи» (только admin)
    CatalogGrid/              # Полноширинная сетка карточек (режим grid вместо списка)
    EquipmentCard/            # Карточка для сетки: SVG-заглушка по категории, статус-бейдж
    CartDrawer/               # Drawer корзины (иконка в хедере с бейджем)
  App.tsx                     # Root: весь стейт, async загрузка, роутинг правой панели
  main.tsx                    # React entry point
  print.css                   # @media print стили
supabase/
  migrations/
    001_initial.sql           # equipment, equipment_history, projects, project_equipment
    002_auth.sql              # profiles, RLS политики
    003_storage_policies.sql  # Storage bucket equipment-images
    004_access_control.sql    # allowed_emails, триггер handle_new_user
    005_history_user.sql      # user_id в equipment_history
    006_project_history.sql   # таблица project_history
    007_employee_assignments.sql # employee_assignments
    008_department.sql        # (устарело) поле department в equipment
    009_profiles_department.sql  # (устарело) поле department в profiles
    010_consumables.sql       # consumables + consumable_transactions
    011_equipment_loans.sql   # equipment_loans
    012_loan_start_date.sql   # start_date в equipment_loans
    013_rooms.sql             # rooms (иерархия помещений)
    014_rooms_responsible.sql # поле responsible в rooms
    015_integration_prep.sql  # profile_id→user_id, is_active в profiles
    016_section_attributes.sql # section, attributes, quantity в equipment
    017_datetime_precision.sql # date→timestamptz для projects и equipment_loans
    018_cart_and_lists.sql    # carts, cart_items, equipment_lists, equipment_list_items, loan_conflict_events
    019_profiles_rls_fix.sql  # RLS: viewer не видит email/роли других
    020_profile_names_function.sql # VIEW/функция profile_names
    021_remove_departments.sql # удалены колонки department из equipment и profiles
    022_inv_number_nullable.sql # inv_number стал nullable (до присвоения из 1С)
    023_composite_equipment.sql # assembly_status в equipment
```

## Auth Flow

**SSO через Nexus (с 2026-06-10):** своей формы логина/регистрации нет. `AuthProvider` оборачивает всё приложение в `App.tsx`, поднимает сессию через `onAuthStateChange` + `supabase.auth.getSession()`. Nexus передаёт токены в URL-хеше (`#access_token=…&refresh_token=…`); `AuthContext` разбирает хеш вручную и поднимает сессию через `setSession()` (`detectSessionInUrl` не подходит — Nexus передаёт только два параметра, а не полный набор). Если сессии нет — `App.tsx` редиректит на `https://nexus.knzteam.ru/login?redirect=<текущий_url>`.

- `loading` в AuthProvider = проверка сессии при старте (с таймаутом 10 с)
- `INITIAL_SESSION` в `onAuthStateChange` пропускается — обработка хеша ещё не завершена, иначе редирект на Nexus до поднятия SSO-сессии
- `dataLoading` в AppInner = загрузка данных из БД после авторизации
- `isRecovery` = пользователь пришёл по ссылке сброса пароля; показывается форма смены пароля вместо основного UI
- `recoveryError` = ссылка сброса пароля устарела/недействительна — показывается сообщение со ссылкой на портал Nexus

`useAuth()` возвращает: `user`, `role`, `userName`, `loading`, `isRecovery`, `recoveryError`, `signOut()`, `updatePassword()`.

**Выход:** `signOut()` немедленно перенаправляет на `https://nexus.knzteam.ru/?logout=1` (гасит сессию Nexus) и параллельно вызывает `supabase.auth.signOut({ scope: 'global' })` (отзывает refresh-токен глобально). Перенаправление именно на `/?logout=1`, а не на `/login?redirect=…` — иначе Nexus, ещё не разлогиненный, сразу вернёт токены обратно.

**Создание пользователей:** через Nexus-онбординг (`public.users` + `auth.users`) — `fetchOrCreateProfile` в `AuthContext` авто-создаёт `inventory.profiles` с ролью `viewer` при первом входе SSO-пользователя; админ Inventory затем повышает роль вручную. `allowed_emails`/триггер `handle_new_user` пока остаются в БД, но форма саморегистрации удалена.

**Доступ запрещён** (`user && !role`): пользователь прошёл auth, но профиля нет — заглушка с кнопкой выхода.

## Role-Based Access

```ts
canEdit = role === 'admin' || role === 'operator'
```

Вкладка «Расходники» и «Списки» в навигации — только для `canEdit` (admin + operator). Вкладка «Пользователи» — только `admin`.

## Services

### `equipmentService`
- `getAll()` — загружает все `equipment` + историю из `equipment_history`, собирает `Equipment[]`. История сортируется по `recorded_at desc` — первая запись = `currentStatus`/`currentLocation`.
- `add(equipment)` — INSERT в `equipment`, затем INSERT первой записи истории.
- `update(equipment)` — UPDATE полей `equipment` (кроме `id` и `inv_number`). Историю не трогает.

### `historyService`
- `addEntry(equipmentId, status, location, responsible)` — INSERT в `equipment_history`. Вызывается из `App` (форма статуса) и из `ProjectDetail`/`assignmentService`/`loanService` (массовые операции).

### `projectService`
- `getAll()` — nested select с `project_equipment(equipment_id)`.
- `add(project)` — INSERT в `projects` + bulk INSERT в `project_equipment`.
- `update(project)` — UPDATE `projects` + DELETE всех `project_equipment` + bulk INSERT новых.
- `remove(id)` — DELETE из `projects` (cascade).

### `projectHistoryService`
- `addEntry(projectId, action, options?)` — INSERT в `project_history`. Action: `'created' | 'updated' | 'activated' | 'finished' | 'equipment_added' | 'equipment_removed'`.
- `getForProject(projectId)` — SELECT последних 100 записей + JOIN имён из `profiles`.

### `assignmentService`
- `assign(equipmentId, profileId, profileName, currentLocation, notes?)` — INSERT в `employee_assignments` + `historyService.addEntry(…, 'Выдан', …)`.
- `returnEquipment(assignmentId, equipmentId)` — UPDATE `returned_at` + `historyService.addEntry(…, 'На Складе', 'Склад', '')`.
- `getCurrentAssignment(equipmentId)` — активная (open) запись с данными профиля.
- `getForProfile(profileId)` — вся история выдач сотруднику с JOIN equipment.

### `loanService`
- Временные займы оборудования между отделами или сотруднику.
- `create(params)` — INSERT в `equipment_loans`; если `startDate <= today`, сразу пишет историю (`'Выдан'` или `'В Работе'`).
- `returnLoan(loanId, equipmentId)` — закрывает заём + `historyService.addEntry(…, 'На Складе', 'Склад', '')`.
- `getAllActiveLoans()` — возвращает `Record<equipmentId, Loan>` для быстрого lookup.
- `getOpenLoans(equipmentId)` / `getLoansForEquipment(equipmentId)` / `getActiveLoansForProfile(profileId)`.

### `consumablesService`
- `getAll()` — SELECT из `consumables` ORDER BY name.
- `add(data)` / `update(id, data)` / `delete(id)` — CRUD.
- `addTransaction(consumableId, type, delta, notes?)` — INSERT в `consumable_transactions`. `type`: `'in' | 'out' | 'writeoff'`. Quantity обновляется триггером в БД.
- `getTransactions(consumableId)` — история движений с JOIN имён из `profiles`.

### `roomService`
- `getAll()` — SELECT из `rooms` ORDER BY office, sort_order.
- `updateResponsible(id, responsible)` — UPDATE поля `responsible`.
- Утилиты (не async): `buildRoomTree(rooms)`, `findRoom(rooms, id)`, `getRoomPath(rooms, roomId)`.
- `OFFICE_LABEL: { A: 'Романов-96', B: 'Знаменка-25', C: 'Знаменка-13' }`.

### `usersService`
- `getProfiles()` / `updateProfile(id, fields)` / `deleteProfile(id)`.
- `getAllowedEntries()` / `addAllowedEntry(entry)` / `updateAllowedEntry(id, fields)` / `deleteAllowedEntry(id)`.

### `cartService`
- Одна корзина на пользователя (lazy-create через `getOrCreateCartId()`).
- `getItems()` / `addItem(equipmentId)` / `removeItem(equipmentId)` / `clear()`.
- Дубликаты игнорируются (`unique` constraint в БД).

### `listService`
- Именованные списки оборудования; могут быть привязаны к проекту или займу.
- `getAll()` / `create(name)` / `update(id, fields)` / `delete(id)`.
- `addItem(listId, equipmentId)` / `removeItem(listId, equipmentId)`.
- `getLoanConflicts()` — `LoanConflictEvent[]` для уведомлений о конфликтах займов.

## State Flow (App.tsx)

Все мутации: **сервис → `loadAll()` → обновление стейта**.

`loadAll()` параллельно загружает: `equipmentService`, `projectService`, `consumablesService`, `roomService`.

**Корзина и списки** загружаются отдельно при старте: `cartService.getItems()` → `setCartItems`; `listService.getAll()` → `setLists`.

**Realtime:** Supabase канал `'db-changes'` подписан на `*` события таблиц `equipment`, `equipment_history`, `projects`, `project_equipment`, `employee_assignments`, `consumables`, `consumable_transactions`, `equipment_loans`. При событии — debounce 300 мс → `realtimeReload()` (обновляет стейт + синхронизирует `selectedEquipment`/`selectedProject`).

**Deep-link URL params:**
- `?eq=<id>` — открывает карточку оборудования, переключает на вкладку «Каталог».
- `?room=<code>` — открывает карточку помещения, переключает на вкладку «Помещения».
После обработки URL очищается через `window.history.replaceState`.

**Ключевые обработчики:**
- `handleStatusUpdate(status, location, responsible)` — `historyService.addEntry()` → `equipmentService.getAll()` → `setItems`.
- `handleEquipmentChange` — `loadAll()` + инкремент `detailKey` (remount `EquipmentDetail`). Вызывается из `ProjectDetail`.
- `handleRoomsChanged` — `roomService.getAll()` → `setRooms` + sync `selectedRoom`.

**`getEquipmentProject(id)`** — первый активный/планируемый проект (сортировка по `startDate`). Передаётся в `EquipmentDetail`.  
**`getEquipmentProjects(id)`** — все активные/планируемые проекты. Передаётся в `EquipmentDetail`.

**`detailKey`** — инкрементируется при внешних изменениях статуса из `ProjectDetail`.

**`duplicateSource`** — `Equipment | null`; если задан, `CreateEquipmentDrawer` открывается в режиме дублирования карточки.

**Навигация:** Sidebar (320px) отображается только для `activeTab === 'catalog' | 'projects'`. Остальные вкладки (`calendar`, `consumables`, `rooms`, `users`, `lists`) — полноширинные в `Content`.

## Components

### `EquipmentDetail`
- `handleSave()` — in-memory мутация + `onStatusUpdate` prop (async, пишет в БД).
- `'Забронировано'` исключён из ручного выбора статуса.
- Кнопка «Печать» → `window.print()`. Классы `no-print`/`print-only`.
- Принимает `rooms: Room[]` для отображения имени помещения.
- **Составные объекты:** принимает `allEquipment: Equipment[]` для поиска родителя/компонентов по `parentId`. Если у карточки есть компоненты — блок «Компоненты (N)» (клик → `onComponentClick`, навигация) и блок «Сборка» с `assemblyStatus` (`assembling`/`ready`/`synced`, переключение через `onAssemblyStatusChange`). Если карточка сама — компонент (`parentId` задан) — бейдж «↳ часть: …» и кнопка «Отвязать от комплекта» (`onDetach`, canEdit) — обнуляет `parentId`.

### `ProjectDetail`
Импортирует `historyService`, `projectService`, `projectHistoryService` напрямую. Все мутирующие хендлеры async.
- `handleActivate()` — `Promise.all`: historyService для каждой единицы + projectService.update + projectHistoryService.addEntry('activated').
- `handleFinish()` — то же, очищает `equipmentIds`.
- `handleRemoveEquipment(eq)` — условный historyService.addEntry + projectService.update.
- `handlePickerConfirm()` — массовый historyService.addEntry + projectService.update.

### `RoomsPage`
- Дерево помещений слева (260px) + детальная карточка справа. На мобиле — toggle.
- QR-код кодирует URL `?room=<code>`. Кнопка «Печать QR» открывает `window.open()` с SVG QR.
- `getRoomSubtreeIds(rooms, roomId)` — BFS для показа оборудования всего поддерева.

### `CalendarView`
- Ant Design `Calendar` с `cellRender` — цветные точки для проектов.
- Показывает проекты на выбранную дату с кол-вом занятого/свободного оборудования.

### `ConsumablesPage`
- Таблица расходников с цветной полоской уровня запаса: зелёный/жёлтый/красный.
- Drawer с карточкой расходника + история транзакций.
- `stockLevel(qty, min)` → `'ok' | 'low' | 'critical'`.

### `EmployeeCard`
- Drawer: список текущих выдач (`assignmentService`) + активные займы (`loanService`) + история выдач.
- Кнопка «Выдать» — пикер из оборудования со статусом `'На Складе'`.

### `CreateEquipmentDrawer`
- Поле фото: `<Upload>` с `customRequest` → Supabase Storage bucket `equipment-images`.
- Поле «Помещение»: `Select` из `rooms` с группировкой по офису.
- `'В Ремонте'` auto-location: ставит локацию `'Ремонт'`, блокирует dropdown. Здесь и в `EquipmentDetail`.
- Поле «Входит в состав» (только секция `tech`): `Select` с поиском по `allEquipment`, доступны только карточки без своего `parentId` (исключает многоуровневые цепочки).

### `CatalogSidebar`
- `exportCsv(items)` — нативный Blob без зависимостей.
- `exportExcel(items)` — `xlsx`: лист «Оборудование» + лист «История».

### `CartDrawer`
- Иконка корзины с бейджем в хедере App.tsx (`cartItems.length`).
- Показывает список оборудования из корзины с кнопками удаления и очистки.

## Key Types

```ts
EquipmentStatus   = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути' | 'Забронировано' | 'Выдан'
EquipmentLocation = 'Склад' | 'Ремонт' | 'В пути' | 'На руках' | 'Офис'
EquipmentSection  = 'tech' | 'furniture' | 'prop'
EquipmentCategory = 'camera' | 'microphone' | 'light' | 'computer' | 'laptop' | 'tv' | 'audio' | 'accessory' | 'optics' | 'phone' | 'stand' | 'furniture' | 'prop' | 'tool'
ProjectStatus     = 'Планируется' | 'Активен' | 'Завершён'
AssemblyStatus    = 'assembling' | 'ready' | 'synced'  // только у родителя составного объекта
UserRole          = 'admin' | 'operator' | 'viewer'
ActiveTab         = 'catalog' | 'projects' | 'users' | 'calendar' | 'consumables' | 'rooms' | 'lists'
```

## Database Schema

Миграции в `supabase/migrations/`. Запускать в Supabase SQL Editor по порядку.

- `equipment` — `section: text` (`tech`/`furniture`/`prop`), `accessories: text[]`, `room_id: uuid`, `attributes: jsonb` (произвольные поля), `quantity: int`, `inv_number: text` (nullable — до присвоения из 1С), `parent_id: uuid` (self-reference, составной объект), `assembly_status: text` (`assembling`/`ready`/`synced`, только у родителя).
- `equipment_history` — `recorded_at desc` = текущий статус. `user_id` добавлен в 005.
- `projects` — `start_date`/`end_date` тип `timestamptz` (с миграции 017), конвертируются через `new Date(row.start_date)`.
- `project_equipment` — join M:M. Синхронизируется DELETE + INSERT при каждом `projectService.update()`.
- `project_history` — лог действий по проекту с `user_id`, `action`, `equipment_id`.
- `employee_assignments` — выдача оборудования сотруднику. Колонка `user_id` (переименована с `profile_id` в 015). `returned_at IS NULL` = активная выдача.
- `equipment_loans` — временные займы. `loan_type: 'employee' | 'department'`. `start_date: timestamptz` позволяет создавать будущие займы.
- `consumables` — `quantity` обновляется триггером при INSERT в `consumable_transactions`.
- `consumable_transactions` — `type: 'in' | 'out' | 'writeoff'`, `delta: int`.
- `rooms` — иерархия (self-reference `parent_id`). `office: 'A' | 'B' | 'C'`, `sort_order`.
- `profiles` — `id, name, role, email, is_active`. Поле `department` удалено (миграция 021).
- `allowed_emails` — `email` и `domain` взаимоисключающие (CHECK). Приоритет: конкретный email над доменом.
- `carts` / `cart_items` — корзина пользователя (одна на user_id), позиции с уникальным `equipment_id`.
- `equipment_lists` / `equipment_list_items` — именованные списки с опциональной привязкой к `project_id`/`loan_id`.
- `loan_conflict_events` — события конфликтов займов (займ перекрывается проектом).

**RLS:** SELECT на `equipment`/`projects`/`project_equipment` открыт всем authenticated. INSERT/UPDATE/DELETE на данных — только admin + operator. `allowed_emails` — SELECT всем authenticated, остальное — только admin. Storage bucket `equipment-images` — публичный на чтение, authenticated на запись.

## Conventions

- **IDs:** `EQP-####` для оборудования, `INV-YYYY-####` для инв. номеров (nullable), `PRJ-####` для проектов.
- **Dates:** `date.toLocaleString('ru-RU')` для datetime, `date.toLocaleDateString('ru-RU')` для date.
- **Ant Design context:** `message`, `modal` — только через `App.useApp()` внутри `<AntApp>`.
- **`STATUS_COLOR`** определён в четырёх местах: `CatalogSidebar`, `EquipmentDetail`, `Dashboard`, `RoomsPage`. При добавлении нового `EquipmentStatus` обновить все четыре.
- **Supabase + onAuthStateChange:** нельзя вызывать `supabase.from()` внутри обработчика `onAuthStateChange` — дедлок с внутренним мьютексом клиента.
- **DB-схема:** все таблицы в схеме `inventory`. `supabase.ts` создаёт клиент с `db: { schema: 'inventory' }`. PostgREST настроен на `db-schemas = inventory, public`.
