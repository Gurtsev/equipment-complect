# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studio equipment inventory management SPA built with React 18 + TypeScript + Vite + Ant Design 5. Two-tab sidebar (Каталог / Проекты) on the left, detail panel on the right. Backend: Supabase (PostgreSQL + Storage + Auth).

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
    supabase.ts          # createClient() с 15-секундным таймаутом на fetch
    equipmentService.ts  # CRUD для таблицы equipment + equipment_history
    historyService.ts    # INSERT в equipment_history
    projectService.ts    # CRUD для таблицы projects + project_equipment
  contexts/
    AuthContext.tsx       # AuthProvider, useAuth hook, роли пользователя
  models/
    Equipment.ts          # Equipment class + TypeScript types
    Project.ts            # Project class + ProjectStatus type
  components/
    LoginPage/            # Форма входа (email + пароль)
    CatalogSidebar/       # Вкладка «Каталог»: поиск, фильтры, список, экспорт
    ProjectsSidebar/      # Вкладка «Проекты»: список проектов со статусами
    EquipmentDetail/      # Правая панель: карточка оборудования
    ProjectDetail/        # Правая панель: карточка проекта
    Dashboard/            # Правая панель по умолчанию: сводная статистика
    CreateEquipmentDrawer/ # Drawer: создание и редактирование оборудования
    CreateProjectDrawer/   # Drawer: создание и редактирование проекта
  App.tsx                 # Root: весь стейт, async загрузка, роутинг правой панели
  main.tsx                # React entry point
  print.css               # @media print стили
  vite-env.d.ts           # Типы для import.meta.env
supabase/
  migrations/
    001_initial.sql       # Схема: equipment, equipment_history, projects, project_equipment
    002_auth.sql          # profiles, RLS политики на всех таблицах
    003_storage_policies.sql # INSERT/UPDATE/DELETE политики для storage.objects
```

## Auth Flow

`AuthProvider` оборачивает всё приложение в `App.tsx`. При монтировании проверяет сессию через `supabase.auth.getSession()`. Подписывается на `onAuthStateChange` для реакции на login/logout.

- `loading` в AuthProvider = проверка сессии при старте (первый рендер)
- `dataLoading` в AppInner = загрузка данных из БД после авторизации
- Условие спиннера: `authLoading || (!!user && dataLoading)` — не показывать спиннер если пользователь не авторизован (иначе форма входа никогда не появится)

`useAuth()` возвращает: `user`, `role`, `userName`, `loading`, `signIn()`, `signOut()`.

**Ручные шаги для нового пользователя:**
1. Создать пользователя в Supabase Dashboard → Authentication → Users
2. Добавить запись в `profiles`: `insert into public.profiles (id, name, role) values ('<uuid>', 'Имя', 'admin')`

## Role-Based Access

`canEdit = role === 'admin' || role === 'operator'`

`App` вычисляет `canEdit` и передаёт как prop в `CatalogSidebar`, `ProjectsSidebar`, `EquipmentDetail`, `ProjectDetail`. Компоненты скрывают кнопки мутаций при `canEdit = false`.

| Скрывается для viewer | Компонент |
|---|---|
| Кнопка «Добавить» оборудование | CatalogSidebar |
| Кнопка «Создать» проект | ProjectsSidebar |
| Кнопки «Изменить», форма статуса | EquipmentDetail |
| «Изменить», «Выдать», «Завершить», «Добавить» в комплект, удаление единицы | ProjectDetail |

Экспорт, печать, QR — доступны всем ролям.

## Services

### `equipmentService`
- `getAll()` — загружает все `equipment` + историю из `equipment_history`, собирает `Equipment[]`. История сортируется по `recorded_at desc` — первая запись = `currentStatus`/`currentLocation`.
- `add(equipment)` — INSERT в `equipment`, затем INSERT первой записи истории.
- `update(equipment)` — UPDATE полей `equipment` (кроме `id` и `inv_number`). Историю не трогает.

### `historyService`
- `addEntry(equipmentId, status, location, responsible)` — INSERT в `equipment_history`. Вызывается из `App` (форма статуса в `EquipmentDetail`) и из `ProjectDetail` (массовые операции).

### `projectService`
- `getAll()` — nested select с `project_equipment(equipment_id)`. `equipmentIds` собирается из массива.
- `add(project)` — INSERT в `projects` + bulk INSERT в `project_equipment`.
- `update(project)` — UPDATE `projects` + DELETE всех `project_equipment` + bulk INSERT новых.
- `remove(id)` — DELETE из `projects` (cascade удаляет `project_equipment`).

## State Flow (App.tsx)

Все мутации: **сервис → `loadAll()` → обновление стейта**.

**Ключевые обработчики:**
- `handleEquipmentCreated` — `equipmentService.add()` → `loadAll()`
- `handleEquipmentUpdated` — `equipmentService.update()` → `loadAll()`
- `handleStatusUpdate(status, location, responsible)` — `historyService.addEntry()` → `equipmentService.getAll()` → `setItems`. Вызывается из `EquipmentDetail` через prop `onStatusUpdate`.
- `handleEquipmentChange` — `loadAll()` + инкремент `detailKey`. Вызывается из `ProjectDetail`.
- `handleProjectCreated` — `projectService.add()` → `loadAll()`
- `handleProjectUpdated` — из `CreateProjectDrawer`; `projectService.update()` → `loadAll()`
- `handleProjectUpdate` — из `ProjectDetail` (он сам уже записал в БД); просто `loadAll()`

**`getEquipmentProject(equipmentId)`** — синхронная функция из стейта `projects`. Передаётся в `EquipmentDetail` и `ProjectDetail`.

**`detailKey`** — инкрементируется при внешних изменениях статуса из `ProjectDetail`, вызывая remount `EquipmentDetail`.

## Components

### `EquipmentDetail`
- `handleSave()` — in-memory мутация + `onStatusUpdate` prop (async, пишет в БД).
- `'Забронировано'` исключён из ручного выбора статуса.
- Кнопка «Печать» → `window.print()`. Классы `no-print`/`print-only`.

### `ProjectDetail`
Импортирует `historyService` и `projectService` напрямую. Все мутирующие хендлеры async.
- `handleActivate()` — `Promise.all`: historyService для каждой единицы + projectService.update
- `handleFinish()` — то же, очищает `equipmentIds`
- `handleRemoveEquipment(eq)` — условный historyService.addEntry + projectService.update
- `handlePickerConfirm()` — массовый historyService.addEntry + projectService.update

### `CreateEquipmentDrawer`
- Поле фото: `<Upload>` с `customRequest` → Supabase Storage bucket `equipment-images`
- Путь файла: `${Date.now()}.${ext}` (уникальный по времени)
- URL сохраняется в скрытый `Form.Item name="image"`

### `CatalogSidebar`
- `exportCsv(items)` — нативный Blob без зависимостей
- `exportExcel(items)` — `xlsx`: лист «Оборудование» + лист «История»

## Key Types

```ts
EquipmentStatus   = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути' | 'Забронировано'
EquipmentLocation = 'Студия Медиа Крыша' | 'Студия на Романовом' | 'Склад' | 'Ремонт' | 'В пути'
EquipmentCategory = 'camera' | 'microphone' | 'light' | 'computer' | 'audio' | 'accessory' | 'optics'
ProjectStatus     = 'Планируется' | 'Активен' | 'Завершён'
UserRole          = 'admin' | 'operator' | 'viewer'
```

## Database Schema

Миграции в `supabase/migrations/`. Запускать в Supabase SQL Editor по порядку.

- `equipment` — основные данные. `accessories` — `text[]`.
- `equipment_history` — история. `recorded_at desc` = текущий статус.
- `projects` — `start_date`/`end_date` тип `date`, приходят строкой `"YYYY-MM-DD"`, конвертируются через `new Date(row.start_date)`.
- `project_equipment` — join M:M. Синхронизируется через DELETE + INSERT при каждом `projectService.update()`.
- `profiles` — `uuid references auth.users`, `name`, `role`. Создаётся вручную для каждого пользователя.

**RLS:** включён на всех таблицах (002_auth.sql). SELECT открыт всем authenticated. INSERT/UPDATE/DELETE — только admin + operator (через `current_user_role()` function). Storage bucket `equipment-images` — публичный на чтение, authenticated на запись (003_storage_policies.sql).

## Conventions

- **IDs:** `EQP-####` для оборудования, `INV-YYYY-####` для инв. номеров, `PRJ-####` для проектов.
- **Dates:** `date.toLocaleString('ru-RU')` для datetime, `date.toLocaleDateString('ru-RU')` для date.
- **Ant Design context:** `message`, `modal` — только через `App.useApp()` внутри `<AntApp>`.
- **`STATUS_COLOR`** в трёх местах: `CatalogSidebar`, `EquipmentDetail`, `Dashboard`. При добавлении нового `EquipmentStatus` обновить все три.
- **`'В Ремонте'` auto-location:** ставит локацию `'Ремонт'`, блокирует dropdown. В `EquipmentDetail` и `CreateEquipmentDrawer`.
