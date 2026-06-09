-- Отдельная схема для таблиц Инвентаризации (разделение пространств при интеграции с Nexus,
-- см. docs/integration-nexus.md: public — общие данные, inventory — наши таблицы, nexus — таблицы Nexus)
create schema if not exists inventory;

grant usage on schema inventory to anon, authenticated, service_role;
alter default privileges in schema inventory grant all on tables to anon, authenticated, service_role;
alter default privileges in schema inventory grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema inventory grant all on functions to anon, authenticated, service_role;

-- Таблица оборудования
create table if not exists inventory.equipment (
  id            text primary key,
  model         text not null,
  subtitle      text not null default '',
  category      text not null,
  description   text not null default '',
  image         text not null default '',
  inv_number    text not null unique,
  serial_number text not null default '',
  responsible   text not null,
  accessories   text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- История перемещений оборудования
create table if not exists inventory.equipment_history (
  id            bigint generated always as identity primary key,
  equipment_id  text not null references inventory.equipment(id) on delete cascade,
  status        text not null,
  location      text not null,
  responsible   text not null,
  recorded_at   timestamptz not null default now()
);

create index if not exists equipment_history_equipment_idx
  on inventory.equipment_history(equipment_id, recorded_at desc);

-- Проекты
create table if not exists inventory.projects (
  id          text primary key,
  name        text not null,
  client      text not null default '',
  start_date  date not null,
  end_date    date not null,
  location    text not null,
  responsible text not null,
  status      text not null default 'Планируется',
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

-- Оборудование в проекте (join-таблица)
create table if not exists inventory.project_equipment (
  project_id   text not null references inventory.projects(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  primary key (project_id, equipment_id)
);

create index if not exists project_equipment_equipment_idx
  on inventory.project_equipment(equipment_id);

-- Storage bucket для фотографий оборудования
-- Создаётся через Dashboard: Storage → New bucket → "equipment-images" → Public
