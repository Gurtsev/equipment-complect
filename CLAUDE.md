# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studio equipment inventory management SPA built with React 18 + TypeScript + Vite + Ant Design 5. Two-tab sidebar (Каталог / Проекты) on the left, detail panel on the right. Backend: Supabase (PostgreSQL + Storage).

## Development Commands

```powershell
npm run dev      # start Vite dev server (hot reload)
npm run build    # tsc + vite build
npm run preview  # preview the production build
```

Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. See `.env.example`.

There are no tests and no linting tools configured.

## Architecture

```
src/
  services/
    supabase.ts          # createClient() — единственное место с URL и anon key
    equipmentService.ts  # CRUD для таблицы equipment + equipment_history
    historyService.ts    # INSERT в equipment_history
    projectService.ts    # CRUD для таблицы projects + project_equipment
  models/
    Equipment.ts         # Equipment class + TypeScript types
    Project.ts           # Project class + ProjectStatus type
  components/
    CatalogSidebar/      # Вкладка «Каталог»: поиск, фильтры, список, экспорт
    ProjectsSidebar/     # Вкладка «Проекты»: список проектов со статусами
    EquipmentDetail/     # Правая панель: карточка оборудования
    ProjectDetail/       # Правая панель: карточка проекта
    Dashboard/           # Правая панель по умолчанию: сводная статистика
    CreateEquipmentDrawer/ # Drawer: создание и редактирование оборудования
    CreateProjectDrawer/   # Drawer: создание и редактирование проекта
  App.tsx                # Root: весь стейт, async загрузка, роутинг правой панели
  main.tsx               # React entry point
  print.css              # @media print стили
  vite-env.d.ts          # Типы для import.meta.env
supabase/
  migrations/
    001_initial.sql      # SQL-схема: equipment, equipment_history, projects, project_equipment
```

## Services

### `equipmentService`
- `getAll()` — загружает все записи `equipment` + их историю из `equipment_history`, собирает `Equipment[]`. История сортируется по `recorded_at desc` — первая запись становится `currentStatus`/`currentLocation`.
- `add(equipment)` — INSERT в `equipment`, затем INSERT первой записи истории в `equipment_history`.
- `update(equipment)` — UPDATE полей `equipment` (кроме `id` и `inv_number`). Историю не трогает.

### `historyService`
- `addEntry(equipmentId, status, location, responsible)` — INSERT в `equipment_history`. Вызывается из `App` (смена статуса через форму в `EquipmentDetail`) и из `ProjectDetail` (массовые операции с комплектом).

### `projectService`
- `getAll()` — загружает все `projects` с вложенным `project_equipment(equipment_id)`. Суpabase возвращает join одним запросом; `equipmentIds` собирается из массива `project_equipment`.
- `add(project)` — INSERT в `projects`, затем bulk INSERT в `project_equipment`.
- `update(project)` — UPDATE `projects` + DELETE всех строк `project_equipment` для этого проекта + bulk INSERT новых. Это гарантирует синхронизацию `equipmentIds` с БД.
- `remove(id)` — DELETE из `projects` (cascade удаляет `project_equipment`).

## State Flow (App.tsx)

`App` загружает данные при монтировании через `loadAll()` (параллельный вызов `equipmentService.getAll()` + `projectService.getAll()`). Все мутации следуют паттерну: **вызов сервиса → `loadAll()` → обновление стейта**.

**Ключевые обработчики:**
- `handleEquipmentCreated` — `equipmentService.add()` → `loadAll()` → `setSelectedEquipment`
- `handleEquipmentUpdated` — `equipmentService.update()` → `loadAll()` → `setSelectedEquipment`
- `handleStatusUpdate(status, location, responsible)` — `historyService.addEntry()` → `equipmentService.getAll()` → `setItems`. Вызывается из `EquipmentDetail` через prop `onStatusUpdate`.
- `handleEquipmentChange` — `loadAll()` + инкремент `detailKey`. Вызывается из `ProjectDetail` после массовых операций с оборудованием.
- `handleProjectCreated` — `projectService.add()` → `loadAll()` → `setSelectedProject`
- `handleProjectUpdated` — вызывается из `CreateProjectDrawer`; `projectService.update()` → `loadAll()`
- `handleProjectUpdate` — вызывается из `ProjectDetail` (он сам уже записал в БД); просто `loadAll()`

**Роутинг правой панели:** `selectedProject` → `ProjectDetail`; `selectedEquipment` → `EquipmentDetail`; ничего → `Dashboard`.

**`getEquipmentProject(equipmentId)`** — синхронная функция, ищет в стейте `projects` активный/планируемый проект с данным equipmentId. Передаётся в `EquipmentDetail` (показать метку проекта) и `ProjectDetail` (блокировать занятое оборудование в пикере).

## Components

### `CatalogSidebar`
Получает `items: Equipment[]` от `App`. Фильтрует и сортирует локально (не через сервис). Имеет собственную функцию `filterItems` — намеренно дублирует логику фильтрации репозитория, чтобы не зависеть от сервисов.

- Фильтры: текстовый поиск (модель / инв. номер), категория, статус, локация, сортировка.
- `exportCsv(items)` — генерирует CSV через нативный `Blob`, скачивает без зависимостей.
- `exportExcel(items)` — два листа через `xlsx`: «Оборудование» + «История» (все записи `equipment_history`).

### `EquipmentDetail`
Принимает `equipment` как prop. Локальный стейт: `status`, `location`, `changedBy`, `history`.

- `handleSave()` — делает in-memory мутацию (`equipment.addHistoryEntry()`) для мгновенного обновления UI, затем вызывает `onStatusUpdate` prop (который пишет в БД и обновляет `items` в App).
- Кнопка «Печать» — `window.print()`. Классы `no-print` / `print-only` управляют видимостью через `print.css`.
- QR-код кодирует `equipment:<id>` и показывается в Modal и при печати.
- `'Забронировано'` исключён из списка статусов для ручного выбора — только через проект.

### `ProjectDetail`
Импортирует `historyService` и `projectService` напрямую. Все мутирующие хендлеры async.

- `handleActivate()` — переводит проект в «Активен», каждую единицу в «В Работе». `Promise.all`: параллельно `historyService.addEntry()` для каждой единицы + `projectService.update(project)`.
- `handleFinish()` — переводит проект в «Завершён», возвращает оборудование на склад, очищает `equipmentIds`. Тот же паттерн.
- `handleRemoveEquipment(eq)` — убирает единицу из проекта; если статус «Забронировано» или «В Работе» — возвращает на склад через `historyService.addEntry()`.
- `handlePickerConfirm()` — добавляет выбранные единицы, ставит статус «Забронировано», сохраняет через сервисы.
- Экспорт комплекта через `xlsx` в функции `exportCompletion()`.

### `CreateEquipmentDrawer`
Работает в двух режимах: создание (нет `initialEquipment`) и редактирование (есть `initialEquipment`).

- Поле «Фотография»: компонент `<Upload>` с `customRequest` — загружает файл в Supabase Storage bucket `equipment-images`, получает публичный URL, записывает в скрытый `Form.Item name="image"`.
- В режиме редактирования `inv_number` задизейблен — инвентарный номер не меняется.
- При создании всегда устанавливает начальный статус `'На Складе'` / локацию `'Склад'`.

## Key Types (`src/models/`)

```ts
// Equipment.ts
EquipmentStatus   = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути' | 'Забронировано'
EquipmentLocation = 'Студия Медиа Крыша' | 'Студия на Романовом' | 'Склад' | 'Ремонт' | 'В пути'
EquipmentCategory = 'camera' | 'microphone' | 'light' | 'computer' | 'audio' | 'accessory' | 'optics'

// Project.ts
ProjectStatus = 'Планируется' | 'Активен' | 'Завершён'
```

`Equipment.currentStatus` и `Equipment.currentLocation` — геттеры, возвращают `history[0].status/location` (история хранится в порядке most-recent-first).

`Equipment.addHistoryEntry(status, location, responsible)` — prepend в `history[]`. Используется для немедленного обновления UI; параллельно вызывается `historyService.addEntry()` для записи в БД.

## Conventions

- **IDs:** `EQP-####` (random 4-digit) для оборудования, `INV-YYYY-####` для инвентарных номеров, `PRJ-####` для проектов.
- **Dates:** `date.toLocaleString('ru-RU')` для datetime, `date.toLocaleDateString('ru-RU')` для date-only.
- **Ant Design context:** `message`, `modal` — только через `App.useApp()` внутри `<AntApp>`.
- **`STATUS_COLOR`** определён в трёх местах: `CatalogSidebar` (plain strings), `EquipmentDetail` (Ant Design preset), `Dashboard` (plain strings). При добавлении нового `EquipmentStatus` обновить все три.
- **`'В Ремонте'` auto-location:** выбор этого статуса автоматически ставит локацию `'Ремонт'` и блокирует dropdown. Реализовано в `EquipmentDetail` и `CreateEquipmentDrawer`.
- **`detailKey`** — инкрементируется при внешних изменениях статуса оборудования (из `ProjectDetail`), вызывая полный remount `EquipmentDetail` и сброс его локального стейта.

## Database Schema

Таблицы в Supabase (PostgreSQL). Миграция: `supabase/migrations/001_initial.sql`.

- `equipment` — основные данные оборудования. `accessories` хранится как `text[]`.
- `equipment_history` — история перемещений. `recorded_at desc` = текущий статус.
- `projects` — проекты. `start_date`/`end_date` тип `date` (без времени), приходят строкой `"YYYY-MM-DD"`, конвертируются в `new Date(row.start_date)`.
- `project_equipment` — join-таблица M:M. При `projectService.update()` синхронизируется через DELETE + INSERT.

RLS отключён (включится в 3.2 вместе с авторизацией). Storage bucket `equipment-images` — публичный.
