# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studio equipment inventory management SPA built with React 18 + TypeScript + Vite + Ant Design 5. Single-page layout: sidebar on the left (two tabs: catalog and projects), detail panel on the right. No backend — all data is in-memory for the current session.

## Development Commands

```powershell
npm run dev      # start Vite dev server (hot reload)
npm run build    # tsc + vite build
npm run preview  # preview the production build
```

There are no tests and no linting tools configured.

## Architecture

```
src/
  models/
    Equipment.ts           # Equipment class + TypeScript types
    EquipmentRepository.ts # In-memory store: getAll/getById/filter/add/replace
    Project.ts             # Project class + ProjectStatus type
    ProjectRepository.ts   # In-memory store: getAll/getById/getByEquipmentId/add/replace/remove
  data/
    equipmentData.ts       # Exports singleton `repository` (starts empty)
    projectData.ts         # Exports singleton `projectRepository` (starts empty)
  components/
    CatalogSidebar/        # Left pane tab 1: search, category filter, equipment list
    ProjectsSidebar/       # Left pane tab 2: project list with status badges
    EquipmentDetail/       # Right pane: equipment info, status update, history, QR modal
    ProjectDetail/         # Right pane: project info, equipment kit management, XLSX export
    Dashboard/             # Right pane default (no selection): inventory summary stats
    CreateEquipmentDrawer/ # Ant Design Drawer: create or edit equipment
    CreateProjectDrawer/   # Ant Design Drawer: create or edit project
  App.tsx                  # Root layout; owns all state; two-tab sidebar + right pane routing
  main.tsx                 # React entry point
```

**State flow:** `App` owns `items`, `projects`, `selectedEquipment`, `selectedProject`, `activeTab`, `detailKey`, `equipmentDrawerMode`, `projectDrawerMode`. Both drawers use a mode of `'create' | 'edit' | null`; passing `initialEquipment`/`initialProject` switches them to edit mode.

**Right pane routing:** `selectedProject` takes priority → `ProjectDetail`; else `selectedEquipment` → `EquipmentDetail`; else → `Dashboard`.

**Data is in-memory only.** Singletons `repository` and `projectRepository` hold live arrays. After mutation, `App` calls `setItems([...repository.getAll()])` or `setProjects([...projectRepository.getAll()])` to trigger re-render.

### Key types

```ts
// src/models/Equipment.ts
EquipmentStatus   = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути' | 'Забронировано'
EquipmentLocation = 'Студия Медиа Крыша' | 'Студия на Романовом' | 'Склад' | 'Ремонт' | 'В пути'
EquipmentCategory = 'camera' | 'microphone' | 'light' | 'computer' | 'audio' | 'accessory' | 'optics'

// src/models/Project.ts
ProjectStatus = 'Планируется' | 'Активен' | 'Завершён'
```

`Equipment.currentStatus` and `Equipment.currentLocation` derive from `history[0]` (most-recent-first).

### Conventions

- **IDs:** `EQP-####` (random 4-digit) for equipment, `INV-YYYY-####` for inventory numbers, `SN-[BRAND]-########` for serial numbers. Projects use a similar random-digit scheme.
- **QR codes:** `qrcode.react` (`QRCodeSVG`); encodes `equipment:<id>`.
- **Dates:** `date.toLocaleString('ru-RU')` for datetime, `date.toLocaleDateString('ru-RU')` for date-only. No utility wrapper needed.
- **Ant Design `App` context:** `message`, `modal`, and `notification` must be accessed via `App.useApp()` inside `<AntApp>` (already wrapping the tree in `App.tsx`).
- **Images:** external URLs (Yandex CDN); local asset at `assets/sonyfx6.webp`.
- **XLSX export:** `xlsx` library — used in `ProjectDetail` to export the equipment kit.

### Non-obvious details

- **`EquipmentDetail` forced remount:** `App` renders `<EquipmentDetail key={`${selectedEquipment.id}-${detailKey}`} .../>`. The compound key ensures remount both on equipment selection change *and* when `ProjectDetail` mutates equipment status externally (via `handleEquipmentChange` which increments `detailKey`).
- **`'В Ремонте'` auto-location:** Selecting status `"В Ремонте"` auto-sets location to `"Ремонт"` and **disables** the location dropdown. Enforced in both `EquipmentDetail` and `CreateEquipmentDrawer`.
- **`'Забронировано'` is project-managed:** This status is set automatically by `ProjectDetail` when equipment is added to a project. It is not selectable manually in `EquipmentDetail` (filtered from the dropdown). When equipment is removed from a project or a project is finished, the status reverts to `'На Складе'`.
- **Filter duplication:** `CatalogSidebar` has its own `filterItems` function that mirrors `EquipmentRepository.filter()`. Intentional — the sidebar receives a plain `items: Equipment[]` prop. If you change filter logic, update both places.
- **`STATUS_COLOR` in three places:** `CatalogSidebar` (plain color strings), `EquipmentDetail` (Ant Design preset statuses), and `Dashboard` (plain color strings). Adding a new `EquipmentStatus` requires updating all three maps.
- **`responsible` on status update:** `EquipmentDetail`'s status update form always uses `equipment.responsible` (the original owner). History entries therefore always carry the original responsible person.
- **New equipment initial state:** `CreateEquipmentDrawer` always creates equipment with `status: 'На Складе'` and `location: 'Склад'`.
- **Project lifecycle:** `Планируется` → add equipment (sets `'Забронировано'`) → "Выдать всё" → `Активен` (equipment → `'В Работе'`) → "Завершить проект" → `Завершён` (equipment → `'На Складе'`, `equipmentIds` cleared).
- **`getEquipmentProject`:** `App` passes this helper (wrapping `projectRepository.getByEquipmentId`) down to both `EquipmentDetail` (to show which project owns the item) and `ProjectDetail` (to block adding already-occupied equipment in the picker).
