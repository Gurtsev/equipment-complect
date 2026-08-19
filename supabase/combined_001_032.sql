-- ============================================================
-- Объединённые миграции 001-032 для применения на чистой self-hosted БД одним скриптом
-- Сгенерировано командой npm run db:combine; вручную не редактировать
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Миграция: 001_initial.sql
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- Миграция: 002_auth.sql
-- ─────────────────────────────────────────────────────────────
-- Профили пользователей (расширяет auth.users)
create table if not exists inventory.profiles (
  id   uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null check (role in ('admin', 'operator', 'viewer'))
);

-- Вспомогательная функция: роль текущего пользователя
create or replace function inventory.current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from inventory.profiles where id = auth.uid()
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table inventory.profiles        enable row level security;
alter table inventory.equipment       enable row level security;
alter table inventory.equipment_history enable row level security;
alter table inventory.projects        enable row level security;
alter table inventory.project_equipment enable row level security;

-- profiles: каждый видит только свой профиль
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (id = auth.uid());

-- equipment
create policy "equipment_select" on inventory.equipment
  for select to authenticated using (true);

create policy "equipment_insert" on inventory.equipment
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "equipment_update" on inventory.equipment
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

create policy "equipment_delete" on inventory.equipment
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- equipment_history
create policy "history_select" on inventory.equipment_history
  for select to authenticated using (true);

create policy "history_insert" on inventory.equipment_history
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

-- projects
create policy "projects_select" on inventory.projects
  for select to authenticated using (true);

create policy "projects_insert" on inventory.projects
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "projects_update" on inventory.projects
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

create policy "projects_delete" on inventory.projects
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- project_equipment
create policy "pe_select" on inventory.project_equipment
  for select to authenticated using (true);

create policy "pe_insert" on inventory.project_equipment
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "pe_delete" on inventory.project_equipment
  for delete to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

-- ─────────────────────────────────────────────────────────────
-- Миграция: 003_storage_policies.sql
-- ─────────────────────────────────────────────────────────────
-- Политики для Storage bucket equipment-images
-- SELECT уже открыт (Public bucket)

create policy "storage_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'equipment-images');

create policy "storage_update"
on storage.objects for update
to authenticated
using (bucket_id = 'equipment-images');

create policy "storage_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'equipment-images');

-- ─────────────────────────────────────────────────────────────
-- Миграция: 004_access_control.sql
-- ─────────────────────────────────────────────────────────────
-- ─── Таблица разрешённых email / доменов ─────────────────────────────────────

create table if not exists inventory.allowed_emails (
  id         uuid default gen_random_uuid() primary key,
  email      text unique,     -- конкретный адрес (взаимоисключающее с domain)
  domain     text unique,     -- домен без @ (взаимоисключающее с email)
  role       text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  note       text,
  created_at timestamptz default now(),
  constraint allowed_emails_one_field check (
    (email is not null and domain is null) or
    (email is null and domain is not null)
  )
);

-- Домен компании разрешён по умолчанию
insert into inventory.allowed_emails (domain, role, note)
values ('megapolis.media', 'viewer', 'Домен компании')
on conflict do nothing;

-- ─── RLS для allowed_emails ───────────────────────────────────────────────────

alter table inventory.allowed_emails enable row level security;

-- Читать могут все аутентифицированные (нужно для страницы администратора)
create policy "allowed_emails_select" on inventory.allowed_emails
  for select to authenticated using (true);

create policy "allowed_emails_insert" on inventory.allowed_emails
  for insert to authenticated
  with check (inventory.current_user_role() = 'admin');

create policy "allowed_emails_update" on inventory.allowed_emails
  for update to authenticated
  using (inventory.current_user_role() = 'admin');

create policy "allowed_emails_delete" on inventory.allowed_emails
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- ─── Добавляем email в profiles ───────────────────────────────────────────────

alter table inventory.profiles
  add column if not exists email text;

-- ─── Триггер: авто-создание профиля при регистрации ──────────────────────────

create or replace function inventory.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_email  text;
  v_domain text;
  v_role   text;
  v_name   text;
begin
  v_email  := new.email;
  v_domain := split_part(v_email, '@', 2);
  v_name   := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  -- Приоритет у конкретного email над доменом
  select role into v_role
  from inventory.allowed_emails
  where email = v_email or domain = v_domain
  order by (email is not null) desc
  limit 1;

  if v_role is not null then
    insert into inventory.profiles (id, name, role, email)
    values (new.id, v_name, v_role, v_email)
    on conflict (id) do nothing;
  end if;

  return new;
exception when others then
  return new; -- не блокируем регистрацию при ошибке в триггере
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function inventory.handle_new_user();

-- ─── Обновление политик profiles ─────────────────────────────────────────────

-- admin видит все профили (нужно для страницы управления пользователями)
drop policy if exists "profiles_select" on inventory.profiles;
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (
    id = auth.uid() or inventory.current_user_role() = 'admin'
  );

-- admin меняет роли и имена
create policy "profiles_update" on inventory.profiles
  for update to authenticated
  using (inventory.current_user_role() = 'admin');

-- admin деактивирует (удаляет профиль, auth.users остаётся)
create policy "profiles_delete" on inventory.profiles
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Миграция: 005_history_user.sql
-- ─────────────────────────────────────────────────────────────
-- user_id в истории оборудования
alter table inventory.equipment_history
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Триггер: автоматически заполняем user_id из сессии при INSERT
create or replace function inventory.set_history_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_history_user_id on inventory.equipment_history;
create trigger set_history_user_id
  before insert on inventory.equipment_history
  for each row execute function inventory.set_history_user_id();

-- Все аутентифицированные видят все профили (нужно для отображения имён в истории)
drop policy if exists "profiles_select" on inventory.profiles;
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────
-- Миграция: 006_project_history.sql
-- ─────────────────────────────────────────────────────────────
create table inventory.project_history (
  id             uuid default gen_random_uuid() primary key,
  project_id     text not null references inventory.projects(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  action         text not null check (action in (
    'equipment_added', 'equipment_removed', 'activated', 'finished', 'created', 'updated'
  )),
  equipment_id   text,
  equipment_name text,
  recorded_at    timestamptz default now()
);

-- Автоматически заполняем user_id из сессии
create or replace function inventory.set_project_history_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_project_history_user_id on inventory.project_history;
create trigger set_project_history_user_id
  before insert on inventory.project_history
  for each row execute function inventory.set_project_history_user_id();

alter table inventory.project_history enable row level security;

create policy "ph_select" on inventory.project_history
  for select to authenticated using (true);

create policy "ph_insert" on inventory.project_history
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

-- Добавить в realtime
alter publication supabase_realtime add table inventory.project_history;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 007_employee_assignments.sql
-- ─────────────────────────────────────────────────────────────
create table inventory.employee_assignments (
  id           uuid default gen_random_uuid() primary key,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  profile_id   uuid not null references inventory.profiles(id) on delete cascade,
  assigned_at  timestamptz default now(),
  returned_at  timestamptz,
  assigned_by  uuid references auth.users(id) on delete set null,
  notes        text
);

-- Автоматически записываем кто выдал
create or replace function inventory.set_assignment_assigned_by()
returns trigger language plpgsql as $$
begin
  if new.assigned_by is null then
    new.assigned_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_assignment_assigned_by on inventory.employee_assignments;
create trigger set_assignment_assigned_by
  before insert on inventory.employee_assignments
  for each row execute function inventory.set_assignment_assigned_by();

alter table inventory.employee_assignments enable row level security;

create policy "ea_select" on inventory.employee_assignments
  for select to authenticated using (true);

create policy "ea_insert" on inventory.employee_assignments
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "ea_update" on inventory.employee_assignments
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

alter publication supabase_realtime add table inventory.employee_assignments;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 008_department.sql
-- ─────────────────────────────────────────────────────────────
alter table inventory.equipment
  add column if not exists department text not null default 'studio'
  check (department in ('studio', 'aho', 'office'));

-- ─────────────────────────────────────────────────────────────
-- Миграция: 009_profiles_department.sql
-- ─────────────────────────────────────────────────────────────
-- Отдел сотрудника (null = нет ограничений по отделу)
alter table inventory.profiles
  add column if not exists department text
  check (department in ('studio', 'aho', 'office'));

-- Вспомогательная функция: отдел текущего пользователя
create or replace function inventory.current_user_department()
returns text
language sql
stable
security definer
set search_path = inventory, public
as $$
  select department from inventory.profiles where id = auth.uid()
$$;

-- Обновляем RLS на equipment: INSERT разрешён только в свой отдел
drop policy if exists "equipment_insert" on inventory.equipment;
create policy "equipment_insert" on inventory.equipment
  for insert to authenticated
  with check (
    inventory.current_user_role() in ('admin', 'operator')
    and (
      inventory.current_user_department() is null
      or department = inventory.current_user_department()
    )
  );

-- Обновляем RLS на equipment: UPDATE разрешён только для своего отдела
drop policy if exists "equipment_update" on inventory.equipment;
create policy "equipment_update" on inventory.equipment
  for update to authenticated
  using (
    inventory.current_user_role() in ('admin', 'operator')
    and (
      inventory.current_user_department() is null
      or department = inventory.current_user_department()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Миграция: 010_consumables.sql
-- ─────────────────────────────────────────────────────────────
-- Расходные материалы
create table inventory.consumables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('hygiene', 'drinks', 'stationery', 'cleaning', 'other')),
  unit text not null default 'шт',
  quantity integer not null default 0 check (quantity >= 0),
  min_threshold integer not null default 0 check (min_threshold >= 0),
  department text check (department in ('studio', 'aho', 'office')),
  notes text,
  created_at timestamptz not null default now()
);

-- Движения по расходным материалам
create table inventory.consumable_transactions (
  id uuid primary key default gen_random_uuid(),
  consumable_id uuid not null references inventory.consumables(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'writeoff')),
  delta integer not null check (delta > 0),
  user_id uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  notes text
);

-- Триггер: обновлять quantity после добавления транзакции
create or replace function inventory.apply_consumable_transaction()
returns trigger language plpgsql security definer set search_path = inventory, public as $$
begin
  if new.type = 'in' then
    update inventory.consumables set quantity = quantity + new.delta where id = new.consumable_id;
  else
    update inventory.consumables set quantity = greatest(0, quantity - new.delta) where id = new.consumable_id;
  end if;
  return new;
end;
$$;

create trigger consumable_transaction_after_insert
after insert on inventory.consumable_transactions
for each row execute function inventory.apply_consumable_transaction();

-- RLS
alter table inventory.consumables enable row level security;
alter table inventory.consumable_transactions enable row level security;

create policy "consumables_select" on inventory.consumables
  for select to authenticated using (true);

create policy "consumables_insert" on inventory.consumables
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "consumables_update" on inventory.consumables
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

create policy "consumables_delete" on inventory.consumables
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

create policy "ctrans_select" on inventory.consumable_transactions
  for select to authenticated using (true);

create policy "ctrans_insert" on inventory.consumable_transactions
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

-- Realtime
alter publication supabase_realtime add table inventory.consumables;
alter publication supabase_realtime add table inventory.consumable_transactions;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 011_equipment_loans.sql
-- ─────────────────────────────────────────────────────────────
-- Временные займы оборудования (сотруднику или в отдел)
create table inventory.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  loan_type text not null check (loan_type in ('employee', 'department')),
  to_profile_id uuid references inventory.profiles(id),
  to_department text check (to_department in ('studio', 'aho', 'office')),
  from_department text not null check (from_department in ('studio', 'aho', 'office')),
  project_id text references inventory.projects(id),
  issued_by uuid references auth.users(id),
  issued_at timestamptz not null default now(),
  due_date date,
  returned_at timestamptz,
  notes text,
  check (
    (loan_type = 'employee' and to_profile_id is not null and to_department is null) or
    (loan_type = 'department' and to_department is not null and to_profile_id is null)
  )
);

-- BEFORE INSERT: заполнить issued_by
create or replace function inventory.set_loan_issued_by()
returns trigger language plpgsql security definer set search_path = inventory, public as $$
begin
  new.issued_by := auth.uid();
  return new;
end;
$$;

create trigger loan_issued_by_trigger
before insert on inventory.equipment_loans
for each row execute function inventory.set_loan_issued_by();

-- RLS
alter table inventory.equipment_loans enable row level security;

create policy "loans_select" on inventory.equipment_loans
  for select to authenticated using (true);

create policy "loans_insert" on inventory.equipment_loans
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "loans_update" on inventory.equipment_loans
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

-- Realtime
alter publication supabase_realtime add table inventory.equipment_loans;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 012_loan_start_date.sql
-- ─────────────────────────────────────────────────────────────
-- Дата начала займа (null = начинается в день оформления)
alter table inventory.equipment_loans
  add column if not exists start_date date;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 013_rooms.sql
-- ─────────────────────────────────────────────────────────────
-- Таблица помещений: 3 уровня через parent_id (Этаж → Помещение → Под-помещение)
create table inventory.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,  -- составной id: A-01-04-01
  office      text not null,         -- 'A' = Романов-96, 'B' = Знаменка-25, 'C' = Знаменка-13
  name        text not null,
  parent_id   uuid references inventory.rooms(id) on delete cascade,
  sort_order  int not null default 0
);

-- RLS
alter table inventory.rooms enable row level security;
create policy "rooms_select" on inventory.rooms for select to authenticated using (true);
create policy "rooms_insert" on inventory.rooms for insert to authenticated
  with check (exists (select 1 from inventory.profiles where id = auth.uid() and role in ('admin', 'operator')));
create policy "rooms_update" on inventory.rooms for update to authenticated
  using (exists (select 1 from inventory.profiles where id = auth.uid() and role in ('admin', 'operator')));
create policy "rooms_delete" on inventory.rooms for delete to authenticated
  using (exists (select 1 from inventory.profiles where id = auth.uid() and role = 'admin'));

-- room_id на оборудовании
alter table inventory.equipment
  add column if not exists room_id uuid references inventory.rooms(id) on delete set null;

-- Индексы
create index rooms_parent_id_idx on inventory.rooms(parent_id);
create index equipment_room_id_idx on inventory.equipment(room_id);

-- ============================================================
-- Предзаполнение: Офис A — Романов-96
-- ============================================================

-- Этажи
insert into inventory.rooms (code, office, name, parent_id, sort_order) values
  ('A-01', 'A', '-1 Этаж', null, 1),
  ('A-02', 'A', '1-й Этаж', null, 2);

-- -1 Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-01', 'A', 'Студия "Подвал"', id, 1 from inventory.rooms where code = 'A-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-02', 'A', 'Студия звукозаписи "Нижняя"', id, 2 from inventory.rooms where code = 'A-01';

-- A-01-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-01-01', 'A', 'Студия "Подвал"', id, 1 from inventory.rooms where code = 'A-01-01';

-- A-01-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-02-01', 'A', 'Студия звукозаписи "Нижняя"', id, 1 from inventory.rooms where code = 'A-01-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-02-02', 'A', 'Вокальная кабина студии "Нижняя"', id, 2 from inventory.rooms where code = 'A-01-02';

-- 1-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-01', 'A', 'Коридор', id, 1 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-02', 'A', 'Комната хранения 1', id, 2 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-03', 'A', 'Туалет 1', id, 3 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-04', 'A', 'Студия "Digital" (Кухня)', id, 4 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-05', 'A', 'Аппаратная ТВ', id, 5 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-06', 'A', 'Кабинет общего назначения "Морской"', id, 6 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-07', 'A', 'Туалет 2', id, 7 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-08', 'A', 'Кабинет технического отдела департамента Радио', id, 8 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09', 'A', 'Аппаратная Радио', id, 9 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-10', 'A', 'Радиоредакция', id, 10 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-11', 'A', 'Кабинет Бренд Медиа', id, 11 from inventory.rooms where code = 'A-02';

-- A-02-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-01-01', 'A', 'Коридор', id, 1 from inventory.rooms where code = 'A-02-01';

-- A-02-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-02-01', 'A', 'Комната хранения 1', id, 1 from inventory.rooms where code = 'A-02-02';

-- A-02-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-03-01', 'A', 'Туалет 1', id, 1 from inventory.rooms where code = 'A-02-03';

-- A-02-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-04-01', 'A', 'Студия "Digital" (Кухня)', id, 1 from inventory.rooms where code = 'A-02-04';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-04-02', 'A', 'Комната хранения 2 (на пожарном выходе)', id, 2 from inventory.rooms where code = 'A-02-04';

-- A-02-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-05-01', 'A', 'Аппаратная ТВ', id, 1 from inventory.rooms where code = 'A-02-05';

-- A-02-06 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-06-01', 'A', 'Кабинет общего назначения "Морской"', id, 1 from inventory.rooms where code = 'A-02-06';

-- A-02-07 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-07-01', 'A', 'Туалет 2', id, 1 from inventory.rooms where code = 'A-02-07';

-- A-02-08 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-08-01', 'A', 'Кабинет технического отдела департамента Радио', id, 1 from inventory.rooms where code = 'A-02-08';

-- A-02-09 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09-01', 'A', 'Аппаратная Радио', id, 1 from inventory.rooms where code = 'A-02-09';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09-02', 'A', 'Радиостудия', id, 2 from inventory.rooms where code = 'A-02-09';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09-03', 'A', 'Кабина звукозаписи', id, 3 from inventory.rooms where code = 'A-02-09';

-- A-02-10 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-10-01', 'A', 'Радиоредакция', id, 1 from inventory.rooms where code = 'A-02-10';

-- A-02-11 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-11-01', 'A', 'Кабинет Бренд Медиа', id, 1 from inventory.rooms where code = 'A-02-11';

-- ============================================================
-- Предзаполнение: Офис B — Знаменка-25
-- ============================================================

-- Этажи
insert into inventory.rooms (code, office, name, parent_id, sort_order) values
  ('B-01', 'B', '1-й Этаж', null, 1),
  ('B-02', 'B', '2-й Этаж', null, 2),
  ('B-03', 'B', '3-й Этаж', null, 3);

-- 1-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-01', 'B', 'Хол 1-го этажа', id, 1 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-02', 'B', 'Студия "Открытый микрофон"', id, 2 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-03', 'B', 'Склад', id, 3 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-04', 'B', 'Туалет 1', id, 4 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-05', 'B', 'Студия "Каминный зал"', id, 5 from inventory.rooms where code = 'B-01';

-- B-01-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-01-01', 'B', 'Хол 1-го этажа', id, 1 from inventory.rooms where code = 'B-01-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-01-02', 'B', 'Подсобное помещение 1', id, 2 from inventory.rooms where code = 'B-01-01';

-- B-01-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-02-01', 'B', 'Студия "Открытый микрофон"', id, 1 from inventory.rooms where code = 'B-01-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-02-02', 'B', 'Кухня', id, 2 from inventory.rooms where code = 'B-01-02';

-- B-01-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-03-01', 'B', 'Склад', id, 1 from inventory.rooms where code = 'B-01-03';

-- B-01-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-04-01', 'B', 'Туалет 1', id, 1 from inventory.rooms where code = 'B-01-04';

-- B-01-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-05-01', 'B', 'Студия "Каминный зал"', id, 1 from inventory.rooms where code = 'B-01-05';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-05-02', 'B', 'Аппаратная ТВ (Офис эфирной бригады)', id, 2 from inventory.rooms where code = 'B-01-05';

-- 2-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-01', 'B', 'Хол 2-го этажа', id, 1 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02', 'B', 'Кабинет отдела Постпродакшена', id, 2 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-03', 'B', 'Туалет 3', id, 3 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-04', 'B', 'Кабинет CEO', id, 4 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-05', 'B', 'Кабинет отдела Дизайна', id, 5 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-06', 'B', 'Кабинет Продюсеров', id, 6 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07', 'B', 'Помещение перед лестницей на 3-й этаж', id, 7 from inventory.rooms where code = 'B-02';

-- B-02-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-01-01', 'B', 'Хол 2-го этажа', id, 1 from inventory.rooms where code = 'B-02-01';

-- B-02-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02-01', 'B', 'Кабинет отдела Постпродакшена', id, 1 from inventory.rooms where code = 'B-02-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02-02', 'B', 'Туалет 2 (Будущая студия звукозаписи)', id, 2 from inventory.rooms where code = 'B-02-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02-03', 'B', 'Подсобное помещение 2', id, 3 from inventory.rooms where code = 'B-02-02';

-- B-02-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-03-01', 'B', 'Туалет 3', id, 1 from inventory.rooms where code = 'B-02-03';

-- B-02-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-04-01', 'B', 'Кабинет CEO', id, 1 from inventory.rooms where code = 'B-02-04';

-- B-02-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-05-01', 'B', 'Кабинет отдела Дизайна', id, 1 from inventory.rooms where code = 'B-02-05';

-- B-02-06 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-06-01', 'B', 'Кабинет Продюсеров', id, 1 from inventory.rooms where code = 'B-02-06';

-- B-02-07 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07-01', 'B', 'Помещение перед лестницей на 3-й этаж', id, 1 from inventory.rooms where code = 'B-02-07';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07-02', 'B', 'Подсобное помещение отдела АХО', id, 2 from inventory.rooms where code = 'B-02-07';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07-03', 'B', 'Подсобное помещение на лестничном пролёте (2-й и 3-й этаж)', id, 3 from inventory.rooms where code = 'B-02-07';

-- 3-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01', 'B', 'Студия "Медиа Крыша"', id, 1 from inventory.rooms where code = 'B-03';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-02', 'B', 'Чердак', id, 2 from inventory.rooms where code = 'B-03';

-- B-03-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01-01', 'B', 'Студия "Медиа Крыша"', id, 1 from inventory.rooms where code = 'B-03-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01-02', 'B', 'Мансарда левое крыло', id, 2 from inventory.rooms where code = 'B-03-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01-03', 'B', 'Мансарда правое крыло', id, 3 from inventory.rooms where code = 'B-03-01';

-- B-03-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-02-01', 'B', 'Чердак (Доступ к кондиционеру)', id, 1 from inventory.rooms where code = 'B-03-02';

-- ============================================================
-- Предзаполнение: Офис C — Знаменка-13
-- ============================================================

-- Этажи
insert into inventory.rooms (code, office, name, parent_id, sort_order) values
  ('C-01', 'C', '1-й Этаж', null, 1);

-- 1-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-01', 'C', 'Хол', id, 1 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-02', 'C', 'Склад 1', id, 2 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-03', 'C', 'Склад 2 / Кабинет руководителей отделов ТВ Тех. и АХО', id, 3 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-04', 'C', 'Кухня', id, 4 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-05', 'C', 'Коридор', id, 5 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-06', 'C', 'Туалет', id, 6 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-07', 'C', 'Кабинет Фин. отдела и документооборота', id, 7 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-08', 'C', 'Кабинет HR и руководителя отдела Спецпроектов', id, 8 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-09', 'C', 'Кабинет отдела спецпроектов (Отдел продаж)', id, 9 from inventory.rooms where code = 'C-01';

-- C-01-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-01-01', 'C', 'Хол', id, 1 from inventory.rooms where code = 'C-01-01';

-- C-01-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-02-01', 'C', 'Склад 1', id, 1 from inventory.rooms where code = 'C-01-02';

-- C-01-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-03-01', 'C', 'Склад 2 / Кабинет руководителей отделов ТВ Тех. и АХО', id, 1 from inventory.rooms where code = 'C-01-03';

-- C-01-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-04-01', 'C', 'Кухня', id, 1 from inventory.rooms where code = 'C-01-04';

-- C-01-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-05-01', 'C', 'Коридор', id, 1 from inventory.rooms where code = 'C-01-05';

-- C-01-06 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-06-01', 'C', 'Туалет', id, 1 from inventory.rooms where code = 'C-01-06';

-- C-01-07 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-07-01', 'C', 'Кабинет Фин. отдела и документооборота', id, 1 from inventory.rooms where code = 'C-01-07';

-- C-01-08 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-08-01', 'C', 'Кабинет HR и руководителя отдела Спецпроектов', id, 1 from inventory.rooms where code = 'C-01-08';

-- C-01-09 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-09-01', 'C', 'Кабинет отдела спецпроектов (Отдел продаж)', id, 1 from inventory.rooms where code = 'C-01-09';

-- ─────────────────────────────────────────────────────────────
-- Миграция: 014_rooms_responsible.sql
-- ─────────────────────────────────────────────────────────────
alter table inventory.rooms
  add column if not exists responsible text not null default '';

-- ─────────────────────────────────────────────────────────────
-- Миграция: 015_integration_prep.sql
-- ─────────────────────────────────────────────────────────────
-- Подготовка к интеграции с Nexus (КСУ)
-- Соглашение об именовании: ссылки на пользователя = user_id
ALTER TABLE inventory.employee_assignments RENAME COLUMN profile_id TO user_id;

-- Добавить is_active для совместимости с shared.users
ALTER TABLE inventory.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 016_section_attributes.sql
-- ─────────────────────────────────────────────────────────────
-- Раздел каталога: tech (Техника), furniture (Мебель), prop (Реквизит)
ALTER TABLE inventory.equipment
  ADD COLUMN section text NOT NULL DEFAULT 'tech'
    CHECK (section IN ('tech', 'furniture', 'prop'));

-- Авто-заполнение section для существующих записей по category
UPDATE inventory.equipment SET section = 'furniture' WHERE category = 'furniture';
UPDATE inventory.equipment SET section = 'prop'      WHERE category = 'prop';

-- Гибкие атрибуты: { "Цвет": "Красный", "Высота": "75 см", ... }
ALTER TABLE inventory.equipment
  ADD COLUMN attributes jsonb;

-- Количество для реквизита (шарики, одежда и т.д.)
ALTER TABLE inventory.equipment
  ADD COLUMN quantity integer;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 017_datetime_precision.sql
-- ─────────────────────────────────────────────────────────────
-- Перевод дат проектов и займов с date на timestamptz
-- Существующие записи получают время 00:00:00 UTC (поведение сохраняется)

alter table inventory.projects
  alter column start_date type timestamptz using start_date::timestamptz,
  alter column end_date   type timestamptz using end_date::timestamptz;

alter table inventory.equipment_loans
  alter column start_date type timestamptz using start_date::timestamptz,
  alter column due_date   type timestamptz using due_date::timestamptz;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 018_cart_and_lists.sql
-- ─────────────────────────────────────────────────────────────
-- Корзина: одна на пользователя, временная (до конвертации в Список)
create table inventory.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table inventory.cart_items (
  id           uuid primary key default gen_random_uuid(),
  cart_id      uuid not null references inventory.carts(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  added_at     timestamptz not null default now(),
  unique (cart_id, equipment_id)
);

-- Списки: постоянные, прикрепляются к проекту или займу (взаимоисключающе)
create table inventory.equipment_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  user_id     uuid not null references auth.users(id),
  project_id  text references inventory.projects(id) on delete set null,
  loan_id     uuid references inventory.equipment_loans(id) on delete set null,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (project_id is null or loan_id is null)
);

create table inventory.equipment_list_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references inventory.equipment_lists(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  added_at     timestamptz not null default now(),
  unique (list_id, equipment_id)
);

-- Уведомления о конфликтах займов
-- (когда проект вытеснил позицию из займа из-за пересечения дат)
create table inventory.loan_conflict_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  loan_id      uuid not null references inventory.equipment_loans(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  project_id   text not null references inventory.projects(id) on delete cascade,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Индексы
create index cart_items_cart_idx           on inventory.cart_items(cart_id);
create index list_items_list_idx           on inventory.equipment_list_items(list_id);
create index list_items_equipment_idx      on inventory.equipment_list_items(equipment_id);
create index equipment_lists_project_idx   on inventory.equipment_lists(project_id) where project_id is not null;
create index equipment_lists_loan_idx      on inventory.equipment_lists(loan_id) where loan_id is not null;
create index loan_conflict_user_idx        on inventory.loan_conflict_events(user_id, is_read);

-- RLS
alter table inventory.carts               enable row level security;
alter table inventory.cart_items          enable row level security;
alter table inventory.equipment_lists     enable row level security;
alter table inventory.equipment_list_items enable row level security;
alter table inventory.loan_conflict_events enable row level security;

-- carts: только своя корзина
create policy "carts_own" on inventory.carts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- cart_items: доступ через cart.user_id
create policy "cart_items_own" on inventory.cart_items
  for all to authenticated
  using (exists (select 1 from inventory.carts where id = cart_id and user_id = auth.uid()))
  with check (exists (select 1 from inventory.carts where id = cart_id and user_id = auth.uid()));

-- equipment_lists: читают все, меняют владелец / admin / operator
create policy "lists_select" on inventory.equipment_lists
  for select to authenticated using (true);

create policy "lists_insert" on inventory.equipment_lists
  for insert to authenticated with check (user_id = auth.uid());

create policy "lists_update" on inventory.equipment_lists
  for update to authenticated
  using (user_id = auth.uid() or inventory.current_user_role() in ('admin', 'operator'));

create policy "lists_delete" on inventory.equipment_lists
  for delete to authenticated
  using (user_id = auth.uid() or inventory.current_user_role() = 'admin');

-- equipment_list_items: читают все, меняют владелец списка / admin / operator
create policy "list_items_select" on inventory.equipment_list_items
  for select to authenticated using (true);

create policy "list_items_write" on inventory.equipment_list_items
  for all to authenticated
  using (exists (
    select 1 from inventory.equipment_lists l
    where l.id = list_id
      and (l.user_id = auth.uid() or inventory.current_user_role() in ('admin', 'operator'))
  ))
  with check (exists (
    select 1 from inventory.equipment_lists l
    where l.id = list_id
      and (l.user_id = auth.uid() or inventory.current_user_role() in ('admin', 'operator'))
  ));

-- loan_conflict_events: видит только адресат, создают admin / operator
create policy "conflict_events_select" on inventory.loan_conflict_events
  for select to authenticated using (user_id = auth.uid());

create policy "conflict_events_insert" on inventory.loan_conflict_events
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "conflict_events_update" on inventory.loan_conflict_events
  for update to authenticated using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table inventory.carts;
alter publication supabase_realtime add table inventory.cart_items;
alter publication supabase_realtime add table inventory.equipment_lists;
alter publication supabase_realtime add table inventory.equipment_list_items;
alter publication supabase_realtime add table inventory.loan_conflict_events;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 019_profiles_rls_fix.sql
-- ─────────────────────────────────────────────────────────────
-- Аудит безопасности 4.11, пункт 1: profiles_select разрешал любому
-- authenticated читать email и роли всех пользователей (using (true), миграция 005).
-- Сужаем до своей записи или admin; для отображения имён в истории — отдельная view без email/role.

create or replace view inventory.profile_names as
  select id, name from inventory.profiles;

grant select on inventory.profile_names to authenticated;

drop policy if exists "profiles_select" on inventory.profiles;
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (
    id = auth.uid() or inventory.current_user_role() = 'admin'
  );

-- ─────────────────────────────────────────────────────────────
-- Миграция: 020_profile_names_function.sql
-- ─────────────────────────────────────────────────────────────
-- Supabase linter помечает profile_names как "Security Definer View" (запросы выполняются
-- с правами владельца, а не вызывающего пользователя) — это намеренно (обход RLS на profiles
-- для отображения имён в истории), но идиоматичный и проверяемый паттерн для этого — функция.
drop view if exists inventory.profile_names;

create or replace function inventory.get_profile_names(ids uuid[])
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = inventory, public
as $$
  select id, name from inventory.profiles where id = any(ids)
$$;

grant execute on function inventory.get_profile_names(uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 021_remove_departments.sql
-- ─────────────────────────────────────────────────────────────
-- Удаление концепции "отдел" (department): операторы получают полный доступ,
-- межотдельские займы оборудования упраздняются.

-- ─── equipment: вернуть RLS к проверке только по роли (как в 002_auth.sql) ──

drop policy if exists "equipment_insert" on inventory.equipment;
create policy "equipment_insert" on inventory.equipment
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

drop policy if exists "equipment_update" on inventory.equipment;
create policy "equipment_update" on inventory.equipment
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

-- ─── удаление вспомогательной функции и колонок department ──────────────────

drop function if exists inventory.current_user_department();

alter table inventory.equipment   drop column if exists department;
alter table inventory.profiles    drop column if exists department;
alter table inventory.consumables drop column if exists department;

-- ─── equipment_loans: убрать займы в отдел, оставить только сотрудникам ─────

-- ВНИМАНИЕ: перед выполнением проверьте наличие записей с loan_type = 'department'.
-- Если такие записи есть, их нужно сначала закрыть/мигрировать вручную —
-- ALTER ниже не пройдёт, пока существуют строки, нарушающие новый CHECK.
--   select * from inventory.equipment_loans where loan_type = 'department';

alter table inventory.equipment_loans drop constraint if exists equipment_loans_check;
alter table inventory.equipment_loans drop constraint if exists equipment_loans_loan_type_check;

alter table inventory.equipment_loans drop column if exists to_department;
alter table inventory.equipment_loans drop column if exists from_department;

alter table inventory.equipment_loans
  add constraint equipment_loans_loan_type_check check (loan_type = 'employee');

alter table inventory.equipment_loans
  add constraint equipment_loans_check check (to_profile_id is not null);

-- ─────────────────────────────────────────────────────────────
-- Миграция: 022_inv_number_nullable.sql
-- ─────────────────────────────────────────────────────────────
-- Инвентарный номер стал необязательным во фронтенде (commit 6a226a7b),
-- но колонка осталась `not null unique` — две карточки без номера (`''`)
-- конфликтуют по уникальному ограничению (23505). NULL в Postgres не
-- конфликтует с NULL под unique-индексом, поэтому делаем колонку nullable
-- и храним отсутствие номера как NULL вместо ''.

alter table inventory.equipment alter column inv_number drop not null;

update inventory.equipment set inv_number = null where inv_number = '';

-- ─────────────────────────────────────────────────────────────
-- Миграция: 023_composite_equipment.sql
-- ─────────────────────────────────────────────────────────────
-- Составные объекты учёта (ПК и комплекты, этап 4.12):
-- equipment может входить в состав другого equipment (parent_id),
-- родитель отслеживает статус сборки для сверки с 1С.

alter table inventory.equipment
  add column parent_id text references inventory.equipment(id) on delete set null;

alter table inventory.equipment
  add column assembly_status text check (assembly_status in ('assembling', 'ready', 'synced'));

create index equipment_parent_id_idx on inventory.equipment(parent_id);

-- ─────────────────────────────────────────────────────────────
-- Миграция: 024_project_list_templates.sql
-- ─────────────────────────────────────────────────────────────
-- Списки становятся переиспользуемыми шаблонами, а не принадлежат одному
-- проекту/займу. Источник каждого импорта сохраняется в истории проекта.

alter table inventory.project_history
  drop constraint if exists project_history_action_check;

alter table inventory.project_history
  add constraint project_history_action_check check (action in (
    'equipment_added', 'equipment_removed', 'activated', 'finished',
    'created', 'updated', 'list_imported'
  ));

alter table inventory.project_history
  add column list_id uuid references inventory.equipment_lists(id) on delete set null,
  add column list_name text,
  add column imported_count integer,
  add column skipped_count integer;

-- Сохраняем уже существующие связи как записи истории до удаления колонок.
insert into inventory.project_history (
  project_id, action, list_id, list_name, imported_count, skipped_count
)
select
  l.project_id,
  'list_imported',
  l.id,
  l.name,
  (select count(*) from inventory.equipment_list_items li where li.list_id = l.id),
  0
from inventory.equipment_lists l
where l.project_id is not null;

drop index if exists inventory.equipment_lists_project_idx;
drop index if exists inventory.equipment_lists_loan_idx;

alter table inventory.equipment_lists
  drop constraint if exists equipment_lists_check;

alter table inventory.equipment_lists
  drop column if exists project_id,
  drop column if exists loan_id;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 025_reconcile_realtime_publication.sql
-- ─────────────────────────────────────────────────────────────
-- Фиксирует Realtime-контракт frontend в схеме inventory.
-- На production часть таблиц могла быть добавлена вручную, поэтому миграция
-- идемпотентна и добавляет только отсутствующие таблицы.

do $$
declare
  target_table text;
  realtime_tables text[] := array[
    'equipment',
    'equipment_history',
    'projects',
    'project_equipment',
    'project_history',
    'employee_assignments',
    'consumables',
    'consumable_transactions',
    'equipment_loans',
    'cart_items',
    'equipment_lists',
    'equipment_list_items',
    'rooms'
  ];
begin
  foreach target_table in array realtime_tables loop
    if not exists (
      select 1
      from pg_publication_tables ppt
      where ppt.pubname = 'supabase_realtime'
        and ppt.schemaname = 'inventory'
        and ppt.tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table %I.%I',
        'inventory',
        target_table
      );
    end if;
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 026_storage_and_allowlist_security.sql
-- ─────────────────────────────────────────────────────────────
-- Security hardening 4.11:
-- 1. Viewer больше не может создавать, заменять и удалять изображения.
-- 2. Список разрешённых email/доменов читает только admin.

drop policy if exists "storage_insert" on storage.objects;
create policy "storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
);

drop policy if exists "storage_update" on storage.objects;
create policy "storage_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
)
with check (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
);

drop policy if exists "storage_delete" on storage.objects;
create policy "storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
);

drop policy if exists "allowed_emails_select" on inventory.allowed_emails;
create policy "allowed_emails_select" on inventory.allowed_emails
  for select to authenticated
  using (inventory.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Миграция: 027_consumables_stock_integrity.sql
-- ─────────────────────────────────────────────────────────────
-- Serialize consumable stock changes and reject partial/negative withdrawals.
create or replace function inventory.apply_consumable_transaction()
returns trigger
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  current_quantity integer;
begin
  select quantity
    into current_quantity
    from inventory.consumables
   where id = new.consumable_id
   for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'INVENTORY_CONSUMABLE_NOT_FOUND';
  end if;

  if new.type = 'in' then
    update inventory.consumables
       set quantity = current_quantity + new.delta
     where id = new.consumable_id;
  else
    if current_quantity < new.delta then
      raise exception using
        errcode = 'P0001',
        message = 'INVENTORY_INSUFFICIENT_STOCK',
        detail = format('available=%s requested=%s', current_quantity, new.delta);
    end if;

    update inventory.consumables
       set quantity = current_quantity - new.delta
     where id = new.consumable_id;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 028_equipment_custody_integrity.sql
-- ─────────────────────────────────────────────────────────────
-- Keep employee assignments and temporary loans mutually consistent.
-- The advisory lock serializes checks across both tables for one equipment item.
do $$
begin
  if exists (
    select 1
      from inventory.employee_assignments
     where returned_at is null
     group by equipment_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce custody integrity: duplicate open employee assignments exist';
  end if;

  if exists (
    select 1
      from inventory.employee_assignments assignment
      join inventory.equipment_loans loan using (equipment_id)
     where assignment.returned_at is null
       and loan.returned_at is null
  ) then
    raise exception 'Cannot enforce custody integrity: open assignments conflict with open loans';
  end if;

  if exists (
    select 1
      from inventory.equipment_loans
     where returned_at is null
       and due_date is not null
       and due_date <= coalesce(start_date, issued_at)
  ) then
    raise exception 'Cannot enforce custody integrity: invalid open loan periods exist';
  end if;

  if exists (
    select 1
      from inventory.equipment_loans first_loan
      join inventory.equipment_loans second_loan
        on second_loan.equipment_id = first_loan.equipment_id
       and second_loan.id > first_loan.id
     where first_loan.returned_at is null
       and second_loan.returned_at is null
       and coalesce(first_loan.start_date, first_loan.issued_at) < coalesce(second_loan.due_date, 'infinity'::timestamptz)
       and coalesce(second_loan.start_date, second_loan.issued_at) < coalesce(first_loan.due_date, 'infinity'::timestamptz)
  ) then
    raise exception 'Cannot enforce custody integrity: overlapping open loans exist';
  end if;
end;
$$;

create or replace function inventory.ensure_equipment_custody_available()
returns trigger
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  requested_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.equipment_id, 0));

  if new.returned_at is not null then
    return new;
  end if;

  if tg_table_name = 'employee_assignments' then
    if exists (
      select 1
        from inventory.employee_assignments assignment
       where assignment.equipment_id = new.equipment_id
         and assignment.returned_at is null
         and assignment.id <> new.id
    ) then
      raise exception using errcode = 'P0001', message = 'INVENTORY_ACTIVE_ASSIGNMENT_EXISTS';
    end if;

    if exists (
      select 1
        from inventory.equipment_loans loan
       where loan.equipment_id = new.equipment_id
         and loan.returned_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'INVENTORY_OPEN_LOAN_EXISTS';
    end if;

    return new;
  end if;

  requested_start := coalesce(new.start_date, new.issued_at, now());

  if new.due_date is not null and new.due_date <= requested_start then
    raise exception using errcode = '22007', message = 'INVENTORY_INVALID_LOAN_PERIOD';
  end if;

  if exists (
    select 1
      from inventory.employee_assignments assignment
     where assignment.equipment_id = new.equipment_id
       and assignment.returned_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_ACTIVE_ASSIGNMENT_EXISTS';
  end if;

  if exists (
    select 1
      from inventory.equipment_loans loan
     where loan.equipment_id = new.equipment_id
       and loan.returned_at is null
       and loan.id <> new.id
       and coalesce(loan.start_date, loan.issued_at) < coalesce(new.due_date, 'infinity'::timestamptz)
       and requested_start < coalesce(loan.due_date, 'infinity'::timestamptz)
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_LOAN_PERIOD_CONFLICT';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_assignment_custody_available on inventory.employee_assignments;
create trigger ensure_assignment_custody_available
before insert or update of equipment_id, returned_at on inventory.employee_assignments
for each row execute function inventory.ensure_equipment_custody_available();

drop trigger if exists ensure_loan_custody_available on inventory.equipment_loans;
create trigger ensure_loan_custody_available
before insert or update of equipment_id, start_date, due_date, returned_at on inventory.equipment_loans
for each row execute function inventory.ensure_equipment_custody_available();

-- Enforce the simple assignment invariant and accelerate open-loan checks.
create unique index if not exists employee_assignments_one_open_per_equipment_idx
  on inventory.employee_assignments (equipment_id)
  where returned_at is null;

create index if not exists equipment_loans_open_equipment_period_idx
  on inventory.equipment_loans (equipment_id, start_date, due_date)
  where returned_at is null;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 029_atomic_custody_operations.sql
-- ─────────────────────────────────────────────────────────────
-- Make custody records and equipment history one atomic operation.
create or replace function inventory.assert_custody_editor()
returns void
language plpgsql
stable
security definer
set search_path = inventory, public
as $$
begin
  if inventory.current_user_role() not in ('admin', 'operator') then
    raise exception using errcode = '42501', message = 'INVENTORY_CUSTODY_FORBIDDEN';
  end if;
end;
$$;

create or replace function inventory.assign_equipment(
  p_equipment_id text,
  p_user_id uuid,
  p_current_location text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  assignment_id uuid;
  profile_name text;
begin
  perform inventory.assert_custody_editor();

  if p_current_location not in ('Склад', 'Ремонт', 'В пути', 'На руках', 'Офис') then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_LOCATION';
  end if;

  select name into profile_name
    from inventory.profiles
   where id = p_user_id
     and is_active = true;

  if profile_name is null then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROFILE_NOT_AVAILABLE';
  end if;

  insert into inventory.employee_assignments (equipment_id, user_id, notes)
  values (p_equipment_id, p_user_id, nullif(btrim(p_notes), ''))
  returning id into assignment_id;

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  values (p_equipment_id, 'Выдан', p_current_location, profile_name);

  return assignment_id;
end;
$$;

create or replace function inventory.return_equipment_assignment(p_assignment_id uuid)
returns text
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  target_equipment_id text;
begin
  perform inventory.assert_custody_editor();

  update inventory.employee_assignments
     set returned_at = now()
   where id = p_assignment_id
     and returned_at is null
  returning equipment_id into target_equipment_id;

  if target_equipment_id is null then
    raise exception using errcode = 'P0001', message = 'INVENTORY_OPEN_ASSIGNMENT_NOT_FOUND';
  end if;

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  values (target_equipment_id, 'На Складе', 'Склад', '');

  return target_equipment_id;
end;
$$;

create or replace function inventory.create_equipment_loan(
  p_equipment_id text,
  p_to_profile_id uuid,
  p_current_location text,
  p_start_date timestamptz,
  p_project_id text,
  p_due_date timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  loan_id uuid;
begin
  perform inventory.assert_custody_editor();

  if p_current_location not in ('Склад', 'Ремонт', 'В пути', 'На руках', 'Офис') then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_LOCATION';
  end if;

  if not exists (
    select 1 from inventory.profiles
     where id = p_to_profile_id
       and is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROFILE_NOT_AVAILABLE';
  end if;

  insert into inventory.equipment_loans (
    equipment_id,
    loan_type,
    to_profile_id,
    start_date,
    project_id,
    due_date,
    notes
  ) values (
    p_equipment_id,
    'employee',
    p_to_profile_id,
    p_start_date,
    p_project_id,
    p_due_date,
    nullif(btrim(p_notes), '')
  ) returning id into loan_id;

  if coalesce(p_start_date, now()) <= now() then
    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    values (p_equipment_id, 'Выдан', p_current_location, '');
  end if;

  return loan_id;
end;
$$;

create or replace function inventory.return_equipment_loan(p_loan_id uuid)
returns text
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  target_equipment_id text;
begin
  perform inventory.assert_custody_editor();

  update inventory.equipment_loans
     set returned_at = now()
   where id = p_loan_id
     and returned_at is null
  returning equipment_id into target_equipment_id;

  if target_equipment_id is null then
    raise exception using errcode = 'P0001', message = 'INVENTORY_OPEN_LOAN_NOT_FOUND';
  end if;

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  values (target_equipment_id, 'На Складе', 'Склад', '');

  return target_equipment_id;
end;
$$;

revoke all on function inventory.assert_custody_editor() from public, anon, authenticated;
revoke all on function inventory.assign_equipment(text, uuid, text, text) from public, anon;
revoke all on function inventory.return_equipment_assignment(uuid) from public, anon;
revoke all on function inventory.create_equipment_loan(text, uuid, text, timestamptz, text, timestamptz, text) from public, anon;
revoke all on function inventory.return_equipment_loan(uuid) from public, anon;

grant execute on function inventory.assign_equipment(text, uuid, text, text) to authenticated;
grant execute on function inventory.return_equipment_assignment(uuid) to authenticated;
grant execute on function inventory.create_equipment_loan(text, uuid, text, timestamptz, text, timestamptz, text) to authenticated;
grant execute on function inventory.return_equipment_loan(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 030_atomic_project_save.sql
-- ─────────────────────────────────────────────────────────────
-- Create/update project metadata, equipment composition and audit history atomically.
create or replace function inventory.assert_project_editor()
returns void
language plpgsql
stable
security definer
set search_path = inventory, public
as $$
begin
  if inventory.current_user_role() not in ('admin', 'operator') then
    raise exception using errcode = '42501', message = 'INVENTORY_PROJECT_FORBIDDEN';
  end if;
end;
$$;

create or replace function inventory.validate_project_payload(
  p_project_id text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_status text,
  p_equipment_ids text[]
)
returns text[]
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  normalized_ids text[];
  equipment_id text;
begin
  if nullif(btrim(p_project_id), '') is null then
    raise exception using errcode = '22023', message = 'INVENTORY_PROJECT_ID_REQUIRED';
  end if;

  if p_end_date <= p_start_date then
    raise exception using errcode = '22007', message = 'INVENTORY_INVALID_PROJECT_PERIOD';
  end if;

  if p_status not in ('Планируется', 'Активен', 'Завершён') then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_PROJECT_STATUS';
  end if;

  select coalesce(array_agg(distinct id order by id), '{}'::text[])
    into normalized_ids
    from unnest(coalesce(p_equipment_ids, '{}'::text[])) as requested(id)
   where nullif(btrim(id), '') is not null;

  foreach equipment_id in array normalized_ids loop
    -- Use the same lock namespace as custody migration 028.
    perform pg_advisory_xact_lock(hashtextextended(equipment_id, 0));
  end loop;

  if exists (
    select 1
      from unnest(normalized_ids) requested(id)
      left join inventory.equipment equipment on equipment.id = requested.id
     where equipment.id is null
  ) then
    raise exception using errcode = '23503', message = 'INVENTORY_PROJECT_EQUIPMENT_NOT_FOUND';
  end if;

  if exists (
    select 1
      from inventory.employee_assignments assignment
     where assignment.equipment_id = any(normalized_ids)
       and assignment.returned_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_EQUIPMENT_ASSIGNED';
  end if;

  if exists (
    select 1
      from inventory.equipment_loans loan
     where loan.equipment_id = any(normalized_ids)
       and loan.returned_at is null
       and coalesce(loan.start_date, loan.issued_at) <= p_end_date
       and p_start_date <= coalesce(loan.due_date, 'infinity'::timestamptz)
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_LOAN_PERIOD_CONFLICT';
  end if;

  if p_status <> 'Завершён' and exists (
    select 1
      from inventory.project_equipment membership
      join inventory.projects other_project on other_project.id = membership.project_id
     where membership.equipment_id = any(normalized_ids)
       and other_project.id <> p_project_id
       and other_project.status <> 'Завершён'
       and p_start_date <= other_project.end_date
       and other_project.start_date <= p_end_date
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_PERIOD_CONFLICT';
  end if;

  return normalized_ids;
end;
$$;

create or replace function inventory.create_project_with_equipment(
  p_project_id text,
  p_name text,
  p_client text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_location text,
  p_responsible text,
  p_status text,
  p_notes text,
  p_equipment_ids text[]
)
returns void
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  normalized_ids text[];
begin
  perform inventory.assert_project_editor();

  if nullif(btrim(p_name), '') is null
     or nullif(btrim(p_location), '') is null
     or nullif(btrim(p_responsible), '') is null then
    raise exception using errcode = '22023', message = 'INVENTORY_PROJECT_REQUIRED_FIELDS';
  end if;

  normalized_ids := inventory.validate_project_payload(
    p_project_id, p_start_date, p_end_date, p_status, p_equipment_ids
  );

  if p_status <> 'Планируется' then
    raise exception using errcode = '22023', message = 'INVENTORY_NEW_PROJECT_MUST_BE_PLANNED';
  end if;

  insert into inventory.projects (
    id, name, client, start_date, end_date, location, responsible, status, notes
  ) values (
    p_project_id,
    btrim(p_name),
    coalesce(btrim(p_client), ''),
    p_start_date,
    p_end_date,
    btrim(p_location),
    btrim(p_responsible),
    p_status,
    coalesce(btrim(p_notes), '')
  );

  insert into inventory.project_equipment (project_id, equipment_id)
  select p_project_id, requested.equipment_id
    from unnest(normalized_ids) as requested(equipment_id);

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  select
    equipment.id,
    'Забронировано',
    coalesce(latest.location, 'Склад'),
    btrim(p_responsible)
  from inventory.equipment equipment
  left join lateral (
    select history.location
      from inventory.equipment_history history
     where history.equipment_id = equipment.id
     order by history.recorded_at desc, history.id desc
     limit 1
  ) latest on true
  where equipment.id = any(normalized_ids);

  insert into inventory.project_history (project_id, action, equipment_id, equipment_name)
  select p_project_id, 'equipment_added', equipment.id, equipment.model
    from inventory.equipment equipment
   where equipment.id = any(normalized_ids);

  insert into inventory.project_history (project_id, action)
  values (p_project_id, 'created');
end;
$$;

create or replace function inventory.update_project_with_equipment(
  p_project_id text,
  p_name text,
  p_client text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_location text,
  p_responsible text,
  p_status text,
  p_notes text,
  p_equipment_ids text[]
)
returns void
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  normalized_ids text[];
  current_project inventory.projects%rowtype;
  current_ids text[];
begin
  perform inventory.assert_project_editor();

  if nullif(btrim(p_name), '') is null
     or nullif(btrim(p_location), '') is null
     or nullif(btrim(p_responsible), '') is null then
    raise exception using errcode = '22023', message = 'INVENTORY_PROJECT_REQUIRED_FIELDS';
  end if;

  select * into current_project
    from inventory.projects
   where id = p_project_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_NOT_FOUND';
  end if;

  if p_status <> current_project.status then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_INVALID_TRANSITION';
  end if;

  normalized_ids := inventory.validate_project_payload(
    p_project_id, p_start_date, p_end_date, p_status, p_equipment_ids
  );

  select coalesce(array_agg(membership.equipment_id order by membership.equipment_id), '{}'::text[])
    into current_ids
    from inventory.project_equipment membership
   where membership.project_id = p_project_id;

  if normalized_ids <> current_ids then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_COMPOSITION_CHANGED';
  end if;

  update inventory.projects
     set name = btrim(p_name),
         client = coalesce(btrim(p_client), ''),
         start_date = p_start_date,
         end_date = p_end_date,
         location = btrim(p_location),
         responsible = btrim(p_responsible),
         status = p_status,
         notes = coalesce(btrim(p_notes), '')
   where id = p_project_id;

  delete from inventory.project_equipment
   where project_equipment.project_id = p_project_id
     and not (project_equipment.equipment_id = any(normalized_ids));

  insert into inventory.project_equipment (project_id, equipment_id)
  select p_project_id, requested.equipment_id
    from unnest(normalized_ids) as requested(equipment_id)
  on conflict (project_id, equipment_id) do nothing;

  insert into inventory.project_history (project_id, action)
  values (p_project_id, 'updated');
end;
$$;

create or replace function inventory.add_project_equipment(
  p_project_id text,
  p_equipment_ids text[],
  p_list_id uuid,
  p_list_name text,
  p_skipped_count integer
)
returns integer
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  target_project inventory.projects%rowtype;
  requested_ids text[];
  current_ids text[];
  target_ids text[];
  added_ids text[];
  closed_loan_equipment_ids text[];
  equipment_id text;
begin
  perform inventory.assert_project_editor();

  select * into target_project
    from inventory.projects
   where id = p_project_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_NOT_FOUND';
  end if;
  if target_project.status = 'Завершён' then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_ALREADY_FINISHED';
  end if;

  select coalesce(array_agg(distinct id order by id), '{}'::text[])
    into requested_ids
    from unnest(coalesce(p_equipment_ids, '{}'::text[])) requested(id)
   where nullif(btrim(id), '') is not null;

  foreach equipment_id in array requested_ids loop
    perform pg_advisory_xact_lock(hashtextextended(equipment_id, 0));
  end loop;

  with closed as (
    update inventory.equipment_loans
       set returned_at = now()
     where equipment_loans.equipment_id = any(requested_ids)
       and equipment_loans.returned_at is null
       and coalesce(equipment_loans.start_date, equipment_loans.issued_at) <= now()
    returning equipment_loans.equipment_id as id
  )
  select coalesce(array_agg(closed.id), '{}'::text[])
    into closed_loan_equipment_ids
    from closed;

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  select distinct closed.equipment_id, 'На Складе', 'Склад', ''
    from unnest(closed_loan_equipment_ids) closed(equipment_id);

  select coalesce(array_agg(membership.equipment_id order by membership.equipment_id), '{}'::text[])
    into current_ids
    from inventory.project_equipment membership
   where membership.project_id = p_project_id;

  select coalesce(array_agg(distinct id order by id), '{}'::text[])
    into target_ids
    from unnest(current_ids || requested_ids) combined(id);

  perform inventory.validate_project_payload(
    p_project_id,
    target_project.start_date,
    target_project.end_date,
    target_project.status,
    target_ids
  );

  select coalesce(array_agg(id order by id), '{}'::text[])
    into added_ids
    from unnest(requested_ids) requested(id)
   where not (id = any(current_ids));

  insert into inventory.project_equipment (project_id, equipment_id)
  select p_project_id, id from unnest(added_ids) added(id);

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  select
    equipment.id,
    case when target_project.status = 'Активен' then 'В Работе' else 'Забронировано' end,
    case
      when target_project.status = 'Активен' then target_project.location
      else coalesce(latest.location, 'Склад')
    end,
    target_project.responsible
  from inventory.equipment equipment
  left join lateral (
    select history.location
      from inventory.equipment_history history
     where history.equipment_id = equipment.id
     order by history.recorded_at desc, history.id desc
     limit 1
  ) latest on true
  where equipment.id = any(added_ids);

  insert into inventory.project_history (project_id, action, equipment_id, equipment_name)
  select p_project_id, 'equipment_added', equipment.id, equipment.model
    from inventory.equipment equipment
   where equipment.id = any(added_ids);

  if p_list_id is not null then
    insert into inventory.project_history (
      project_id, action, list_id, list_name, imported_count, skipped_count
    ) values (
      p_project_id,
      'list_imported',
      p_list_id,
      nullif(btrim(p_list_name), ''),
      cardinality(added_ids),
      greatest(coalesce(p_skipped_count, 0), 0)
    );
  end if;

  return cardinality(closed_loan_equipment_ids);
end;
$$;

create or replace function inventory.remove_project_equipment(
  p_project_id text,
  p_equipment_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  target_project inventory.projects%rowtype;
  requested_ids text[];
  removed_ids text[];
  equipment_id text;
begin
  perform inventory.assert_project_editor();

  select * into target_project
    from inventory.projects
   where id = p_project_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_NOT_FOUND';
  end if;
  if target_project.status = 'Завершён' then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_ALREADY_FINISHED';
  end if;

  select coalesce(array_agg(distinct id order by id), '{}'::text[])
    into requested_ids
    from unnest(coalesce(p_equipment_ids, '{}'::text[])) requested(id)
   where nullif(btrim(id), '') is not null;

  foreach equipment_id in array requested_ids loop
    perform pg_advisory_xact_lock(hashtextextended(equipment_id, 0));
  end loop;

  with removed as (
    delete from inventory.project_equipment
     where project_equipment.project_id = p_project_id
       and project_equipment.equipment_id = any(requested_ids)
    returning project_equipment.equipment_id as id
  )
  select coalesce(array_agg(removed.id), '{}'::text[])
    into removed_ids
    from removed;

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  select removed.id, 'На Складе', 'Склад', target_project.responsible
    from unnest(removed_ids) removed(id)
    join lateral (
      select history.status
        from inventory.equipment_history history
       where history.equipment_id = removed.id
       order by history.recorded_at desc, history.id desc
       limit 1
    ) latest on latest.status in ('Забронировано', 'В Работе');

  insert into inventory.project_history (project_id, action, equipment_id, equipment_name)
  select p_project_id, 'equipment_removed', equipment.id, equipment.model
    from inventory.equipment equipment
   where equipment.id = any(removed_ids);

  return cardinality(removed_ids);
end;
$$;

create or replace function inventory.transition_project(
  p_project_id text,
  p_target_status text
)
returns integer
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  target_project inventory.projects%rowtype;
  equipment_ids text[];
  equipment_id text;
begin
  perform inventory.assert_project_editor();

  select * into target_project
    from inventory.projects
   where id = p_project_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_NOT_FOUND';
  end if;

  select coalesce(array_agg(membership.equipment_id order by membership.equipment_id), '{}'::text[])
    into equipment_ids
    from inventory.project_equipment membership
   where membership.project_id = p_project_id;

  foreach equipment_id in array equipment_ids loop
    perform pg_advisory_xact_lock(hashtextextended(equipment_id, 0));
  end loop;

  if p_target_status = 'Активен' then
    if target_project.status <> 'Планируется' then
      raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_INVALID_TRANSITION';
    end if;
    if cardinality(equipment_ids) = 0 then
      raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_EMPTY';
    end if;

    perform inventory.validate_project_payload(
      p_project_id,
      target_project.start_date,
      target_project.end_date,
      p_target_status,
      equipment_ids
    );

    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    select id, 'В Работе', target_project.location, target_project.responsible
      from unnest(equipment_ids) equipment(id);

    update inventory.projects set status = 'Активен' where id = p_project_id;
    insert into inventory.project_history (project_id, action) values (p_project_id, 'activated');
  elsif p_target_status = 'Завершён' then
    if target_project.status <> 'Активен' then
      raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_INVALID_TRANSITION';
    end if;

    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    select id, 'На Складе', 'Склад', target_project.responsible
      from unnest(equipment_ids) equipment(id);

    delete from inventory.project_equipment where project_id = p_project_id;
    update inventory.projects set status = 'Завершён' where id = p_project_id;
    insert into inventory.project_history (project_id, action) values (p_project_id, 'finished');
  else
    raise exception using errcode = '22023', message = 'INVENTORY_PROJECT_INVALID_TRANSITION';
  end if;

  return cardinality(equipment_ids);
end;
$$;

revoke all on function inventory.assert_project_editor() from public, anon, authenticated;
revoke all on function inventory.validate_project_payload(text, timestamptz, timestamptz, text, text[]) from public, anon, authenticated;
revoke all on function inventory.create_project_with_equipment(text, text, text, timestamptz, timestamptz, text, text, text, text, text[]) from public, anon;
revoke all on function inventory.update_project_with_equipment(text, text, text, timestamptz, timestamptz, text, text, text, text, text[]) from public, anon;
revoke all on function inventory.add_project_equipment(text, text[], uuid, text, integer) from public, anon;
revoke all on function inventory.remove_project_equipment(text, text[]) from public, anon;
revoke all on function inventory.transition_project(text, text) from public, anon;

grant execute on function inventory.create_project_with_equipment(text, text, text, timestamptz, timestamptz, text, text, text, text, text[]) to authenticated;
grant execute on function inventory.update_project_with_equipment(text, text, text, timestamptz, timestamptz, text, text, text, text, text[]) to authenticated;
grant execute on function inventory.add_project_equipment(text, text[], uuid, text, integer) to authenticated;
grant execute on function inventory.remove_project_equipment(text, text[]) to authenticated;
grant execute on function inventory.transition_project(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 031_atomic_equipment_create.sql
-- ─────────────────────────────────────────────────────────────
-- Create an equipment card and its initial history entry atomically.
create or replace function inventory.create_equipment_with_history(
  p_id text,
  p_model text,
  p_subtitle text,
  p_category text,
  p_section text,
  p_description text,
  p_image text,
  p_inv_number text,
  p_serial_number text,
  p_responsible text,
  p_accessories text[],
  p_room_id uuid,
  p_attributes jsonb,
  p_quantity integer,
  p_parent_id text,
  p_assembly_status text
)
returns text
language plpgsql
security definer
set search_path = inventory, public
as $$
begin
  if inventory.current_user_role() not in ('admin', 'operator') then
    raise exception using errcode = '42501', message = 'INVENTORY_EQUIPMENT_CREATE_FORBIDDEN';
  end if;

  if nullif(btrim(p_id), '') is null or nullif(btrim(p_model), '') is null then
    raise exception using errcode = '22023', message = 'INVENTORY_EQUIPMENT_REQUIRED_FIELD';
  end if;

  insert into inventory.equipment (
    id,
    model,
    subtitle,
    category,
    section,
    description,
    image,
    inv_number,
    serial_number,
    responsible,
    accessories,
    room_id,
    attributes,
    quantity,
    parent_id,
    assembly_status
  ) values (
    btrim(p_id),
    btrim(p_model),
    coalesce(btrim(p_subtitle), ''),
    p_category,
    p_section,
    coalesce(btrim(p_description), ''),
    coalesce(btrim(p_image), ''),
    nullif(btrim(p_inv_number), ''),
    coalesce(btrim(p_serial_number), ''),
    coalesce(btrim(p_responsible), ''),
    coalesce(p_accessories, '{}'::text[]),
    p_room_id,
    p_attributes,
    p_quantity,
    p_parent_id,
    p_assembly_status
  );

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  values (btrim(p_id), 'На Складе', 'Склад', coalesce(btrim(p_responsible), ''));

  return btrim(p_id);
end;
$$;

revoke all on function inventory.create_equipment_with_history(
  text, text, text, text, text, text, text, text, text, text,
  text[], uuid, jsonb, integer, text, text
) from public, anon;

grant execute on function inventory.create_equipment_with_history(
  text, text, text, text, text, text, text, text, text, text,
  text[], uuid, jsonb, integer, text, text
) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Миграция: 032_atomic_assembly_status.sql
-- ─────────────────────────────────────────────────────────────
-- Change composite-equipment assembly status and append its status history atomically.
create or replace function inventory.set_equipment_assembly_status(
  p_equipment_id text,
  p_assembly_status text
)
returns void
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_responsible text;
  v_location text;
begin
  if inventory.current_user_role() not in ('admin', 'operator') then
    raise exception using errcode = '42501', message = 'INVENTORY_ASSEMBLY_STATUS_FORBIDDEN';
  end if;

  if nullif(btrim(p_equipment_id), '') is null
     or p_assembly_status is null
     or p_assembly_status not in ('assembling', 'ready', 'synced') then
    raise exception using errcode = '22023', message = 'INVENTORY_ASSEMBLY_STATUS_INVALID';
  end if;

  select responsible
  into v_responsible
  from inventory.equipment
  where id = btrim(p_equipment_id)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_EQUIPMENT_NOT_FOUND';
  end if;

  update inventory.equipment
  set assembly_status = p_assembly_status
  where id = btrim(p_equipment_id);

  if p_assembly_status = 'assembling' then
    select location
    into v_location
    from inventory.equipment_history
    where equipment_id = btrim(p_equipment_id)
    order by recorded_at desc, id desc
    limit 1;

    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    values (
      btrim(p_equipment_id),
      'Комплектуется',
      coalesce(v_location, 'Склад'),
      coalesce(v_responsible, '')
    );
  elsif p_assembly_status = 'ready' then
    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    values (btrim(p_equipment_id), 'На Складе', 'Склад', coalesce(v_responsible, ''));
  end if;
end;
$$;

revoke all on function inventory.set_equipment_assembly_status(text, text)
from public, anon;

grant execute on function inventory.set_equipment_assembly_status(text, text)
to authenticated;
