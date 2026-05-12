# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studio equipment inventory management SPA built with React 18 + TypeScript + Vite + Ant Design 5. Single-page layout: sidebar catalog on the left, detail panel on the right. No backend — all data is in-memory for the current session.

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
    EquipmentRepository.ts # In-memory store with filter/add
  data/
    equipmentData.ts       # Hardcoded seed data; exports singleton `repository`
  components/
    CatalogSidebar/        # Left pane: search, category filter, item list
    EquipmentDetail/       # Right pane: info, status update, history table, QR modal
    CreateEquipmentDrawer/ # Ant Design Drawer form for adding new equipment
  App.tsx                  # Root layout (Ant Design Layout Sider + Content)
  main.tsx                 # React entry point
```

**State flow:** `App` owns `items` (array) and `selected` (single item). `CatalogSidebar` filters and selects; `EquipmentDetail` mutates the selected `Equipment` instance directly via `addHistoryEntry()` and reads back the updated history into local state.

**Data is in-memory only.** `repository` (singleton `EquipmentRepository`) holds the live array; `repository.add()` is called on creation, then `App` re-reads via `repository.getAll()` to trigger a re-render.

### Key types (`src/models/Equipment.ts`)

```ts
EquipmentStatus   = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути'
EquipmentLocation = 'Студия Медиа Крыша' | 'Студия на Романовом' | 'Склад' | 'Ремонт' | 'В пути'
EquipmentCategory = 'camera' | 'microphone' | 'light' | 'computer' | 'audio' | 'accessory' | 'optics'
```

`Equipment.currentStatus` and `Equipment.currentLocation` derive from `history[0]` (most-recent-first).  
Selecting status `"В Ремонте"` auto-sets location to `"Ремонт"` (enforced in both `EquipmentDetail` and `CreateEquipmentDrawer`).

### Conventions

- **IDs:** `EQP-####` (random 4-digit) for equipment, `INV-YYYY-####` for inventory numbers, `SN-[BRAND]-########` for serial numbers.
- **QR codes:** `qrcode.react` (`QRCodeSVG`); encodes `equipment:<id>`.
- **Dates:** `date.toLocaleString('ru-RU')` — no utility wrapper needed.
- **Ant Design `App` context:** `message` and `notification` must be accessed via `App.useApp()` — components that need them must be descendants of `<AntApp>` (already wrapping the tree in `App.tsx`).
- **Images:** external URLs (Yandex CDN); local asset at `assets/sonyfx6.webp`.

### Non-obvious details

- **`EquipmentDetail` state reset:** `App` renders `<EquipmentDetail key={selected.id} .../>`. The `key` prop causes a full remount on selection change, which resets the component's local `status`, `location`, and `history` state to match the newly selected item.
- **Filter duplication:** `CatalogSidebar` has its own `filterItems` function that mirrors `EquipmentRepository.filter()`. This is intentional — the sidebar receives a plain `items: Equipment[]` prop from `App` and doesn't access the repository directly. If you change filter logic, update both places.
- **`STATUS_COLOR` duplication:** defined in both `CatalogSidebar` (plain color strings, e.g. `'green'`) and `EquipmentDetail` (Ant Design preset statuses, e.g. `'success'`). Adding a new `EquipmentStatus` value requires updating both maps.
- **`responsible` on status update:** the "Обновить статус" form in `EquipmentDetail` has no responsible input — it always uses `equipment.responsible` (the original owner). History entries therefore always carry the original responsible person.
- **New equipment initial state:** `CreateEquipmentDrawer` always creates equipment with `status: 'На Складе'` and `location: 'Склад'`. There is no initial status/location selector in the form.
