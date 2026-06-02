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
  contexts/
    AuthContext.tsx            # AuthProvider, useAuth hook, роли и отдел пользователя
  models/
    Equipment.ts              # Equipment class + TypeScript types
    Project.ts                # Project class + ProjectStatus type
  components/
    LoginPage/                # Форма входа + регистрации + сброс пароля
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
    EmployeeCard/             # Drawer из UsersPage: выданное оборудование сотрудника
    UsersPage/                # Вкладка «Пользователи» (только admin)
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
    008_department.sql        # поле department в equipment
    009_profiles_department.sql  # поле department в profiles
    010_consumables.sql       # consumables + consumable_transactions
    011_equipment_loans.sql   # equipment_loans
    012_loan_start_date.sql   # start_date в equipment_loans
    013_rooms.sql             # rooms (иерархия помещений)
    014_rooms_responsible.sql # поле responsible в rooms
```

## Auth Flow

`AuthProvider` оборачивает всё приложение в `App.tsx`. При монтировании проверяет сессию через `supabase.auth.getSession()`. Подписывается на `onAuthStateChange` для login/logout/recovery.

- `loading` в AuthProvider = проверка сессии при старте
- `dataLoading` в AppInner = загрузка данных из БД после авторизации
- `isRecovery` = пользователь пришёл по ссылке сброса пароля; показывается форма смены пароля вместо основного UI

`useAuth()` возвращает: `user`, `role`, `userName`, `userDepartment`, `loading`, `isRecovery`, `signIn()`, `signUp()`, `signOut()`, `updatePassword()`.

**Создание пользователей — два способа:**
- **Авторазрешённая регистрация:** добавить email или домен в `allowed_emails`. Триггер `handle_new_user` создаёт `profiles` запись с ролью и `department` из `allowed_emails`.
- **Ручной способ:** создать в Supabase Dashboard → Authentication → Users, затем: `insert into public.profiles (id, name, role, email) values ('<uuid>', 'Имя', 'admin', 'email@example.com')`

**Доступ запрещён** (`user && !role`): пользователь прошёл auth, но профиля нет — заглушка с кнопкой выхода.

## Role-Based Access

```ts
canEdit = role === 'admin' || role === 'operator'
canEditEquipment(dept) = canEdit && (userDepartment === null || userDepartment === dept)
```

`canEditEquipment` передаётся в `EquipmentDetail` вместо `canEdit` — оператор с привязанным отделом не может редактировать оборудование чужого отдела.

Вкладка «Расходники» в навигации — только для `canEdit` (admin + operator). Вкладка «Пользователи» — только `admin`.

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

## State Flow (App.tsx)

Все мутации: **сервис → `loadAll()` → обновление стейта**.

`loadAll()` параллельно загружает: `equipmentService`, `projectService`, `consumablesService`, `roomService`.

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

**Навигация:** Sidebar (320px) отображается только для `activeTab === 'catalog' | 'projects'`. Остальные вкладки (`calendar`, `consumables`, `rooms`, `users`) — полноширинные в `Content`.

## Components

### `EquipmentDetail`
- `handleSave()` — in-memory мутация + `onStatusUpdate` prop (async, пишет в БД).
- `'Забронировано'` исключён из ручного выбора статуса.
- Кнопка «Печать» → `window.print()`. Классы `no-print`/`print-only`.
- Принимает `rooms: Room[]` для отображения имени помещения.

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

### `CatalogSidebar`
- `exportCsv(items)` — нативный Blob без зависимостей.
- `exportExcel(items)` — `xlsx`: лист «Оборудование» + лист «История».

## Key Types

```ts
EquipmentStatus   = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути' | 'Забронировано' | 'Выдан'
EquipmentLocation = 'Склад' | 'Ремонт' | 'В пути' | 'На руках' | 'Офис'
EquipmentCategory = 'camera' | 'microphone' | 'light' | 'computer' | 'audio' | 'accessory' | 'optics' | 'phone' | 'furniture' | 'prop' | 'tool'
EquipmentDepartment = 'studio' | 'aho' | 'office'
ProjectStatus     = 'Планируется' | 'Активен' | 'Завершён'
UserRole          = 'admin' | 'operator' | 'viewer'
ActiveTab         = 'catalog' | 'projects' | 'users' | 'calendar' | 'consumables' | 'rooms'
```

## Database Schema

Миграции в `supabase/migrations/`. Запускать в Supabase SQL Editor по порядку.

- `equipment` — `accessories: text[]`, `department: EquipmentDepartment`, `room_id: uuid`.
- `equipment_history` — `recorded_at desc` = текущий статус. `user_id` добавлен в 005.
- `projects` — `start_date`/`end_date` тип `date`, конвертируются через `new Date(row.start_date)`.
- `project_equipment` — join M:M. Синхронизируется DELETE + INSERT при каждом `projectService.update()`.
- `project_history` — лог действий по проекту с `user_id`, `action`, `equipment_id`.
- `employee_assignments` — выдача оборудования сотруднику. `returned_at IS NULL` = активная выдача.
- `equipment_loans` — временные займы. `loan_type: 'employee' | 'department'`. `start_date` позволяет создавать будущие займы.
- `consumables` — `quantity` обновляется триггером при INSERT в `consumable_transactions`.
- `consumable_transactions` — `type: 'in' | 'out' | 'writeoff'`, `delta: int`.
- `rooms` — иерархия (self-reference `parent_id`). `office: 'A' | 'B' | 'C'`, `sort_order`.
- `profiles` — `department: EquipmentDepartment | null` (ограничение редактирования для operator).
- `allowed_emails` — `email` и `domain` взаимоисключающие (CHECK). Приоритет: конкретный email над доменом.

**RLS:** SELECT на `equipment`/`projects`/`project_equipment` открыт всем authenticated. INSERT/UPDATE/DELETE на данных — только admin + operator. `allowed_emails` — SELECT всем authenticated, остальное — только admin. Storage bucket `equipment-images` — публичный на чтение, authenticated на запись.

## Conventions

- **IDs:** `EQP-####` для оборудования, `INV-YYYY-####` для инв. номеров, `PRJ-####` для проектов.
- **Dates:** `date.toLocaleString('ru-RU')` для datetime, `date.toLocaleDateString('ru-RU')` для date.
- **Ant Design context:** `message`, `modal` — только через `App.useApp()` внутри `<AntApp>`.
- **`STATUS_COLOR`** определён в четырёх местах: `CatalogSidebar`, `EquipmentDetail`, `Dashboard`, `RoomsPage`. При добавлении нового `EquipmentStatus` обновить все четыре.
- **Supabase + onAuthStateChange:** нельзя вызывать `supabase.from()` внутри обработчика `onAuthStateChange` — дедлок с внутренним мьютексом клиента.
