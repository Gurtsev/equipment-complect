-- Physical inventory sessions: immutable expectations, concurrent scans and final discrepancy report.
create table inventory.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  room_id uuid not null references inventory.rooms(id),
  include_descendants boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'review', 'completed', 'cancelled')),
  created_by uuid not null default auth.uid() references inventory.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  notes text not null default ''
);

create table inventory.inventory_session_items (
  id bigint generated always as identity primary key,
  session_id uuid not null references inventory.inventory_sessions(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id),
  expected_room_id uuid references inventory.rooms(id),
  expected_status text not null default '',
  expected_responsible text not null default '',
  expected_context text not null default 'room' check (expected_context in ('room', 'assignment', 'loan', 'project', 'unexpected')),
  result text not null default 'pending' check (result in ('pending', 'found', 'misplaced', 'accounted_elsewhere', 'missing', 'unexpected')),
  actual_room_id uuid references inventory.rooms(id),
  scanned_by uuid references inventory.profiles(id),
  scanned_at timestamptz,
  note text not null default '',
  unique (session_id, equipment_id)
);

create table inventory.inventory_scans (
  id bigint generated always as identity primary key,
  session_id uuid not null references inventory.inventory_sessions(id) on delete cascade,
  raw_code text not null,
  equipment_id text references inventory.equipment(id),
  actual_room_id uuid references inventory.rooms(id),
  result text not null check (result in ('found', 'misplaced', 'accounted_elsewhere', 'unexpected', 'duplicate', 'unknown')),
  scanned_by uuid not null default auth.uid() references inventory.profiles(id),
  scanned_at timestamptz not null default now()
);

create index inventory_sessions_created_at_idx on inventory.inventory_sessions(created_at desc);
create index inventory_session_items_session_result_idx on inventory.inventory_session_items(session_id, result);
create index inventory_scans_session_scanned_idx on inventory.inventory_scans(session_id, scanned_at desc);

alter table inventory.inventory_sessions enable row level security;
alter table inventory.inventory_session_items enable row level security;
alter table inventory.inventory_scans enable row level security;

create policy inventory_sessions_select on inventory.inventory_sessions
  for select to authenticated using (true);
create policy inventory_session_items_select on inventory.inventory_session_items
  for select to authenticated using (true);
create policy inventory_scans_select on inventory.inventory_scans
  for select to authenticated using (true);

create or replace function inventory.create_inventory_session(
  p_name text,
  p_room_id uuid,
  p_include_descendants boolean default true,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_session_id uuid;
begin
  perform inventory.assert_custody_editor();

  if nullif(btrim(p_name), '') is null or not exists (select 1 from inventory.rooms where id = p_room_id) then
    raise exception using errcode = '22023', message = 'INVENTORY_SESSION_INVALID_INPUT';
  end if;

  insert into inventory.inventory_sessions (name, room_id, include_descendants, status, started_at, notes)
  values (btrim(p_name), p_room_id, coalesce(p_include_descendants, true), 'in_progress', now(), coalesce(btrim(p_notes), ''))
  returning id into v_session_id;

  with recursive scoped_rooms as (
    select id from inventory.rooms where id = p_room_id
    union all
    select child.id
      from inventory.rooms child
      join scoped_rooms parent on child.parent_id = parent.id
     where coalesce(p_include_descendants, true)
  ), expected as (
    select
      equipment.id,
      equipment.room_id,
      coalesce(history.status, 'На Складе') as status,
      coalesce(history.responsible, equipment.responsible, '') as responsible,
      case
        when exists (select 1 from inventory.employee_assignments a where a.equipment_id = equipment.id and a.returned_at is null) then 'assignment'
        when exists (select 1 from inventory.equipment_loans l where l.equipment_id = equipment.id and l.returned_at is null) then 'loan'
        when exists (
          select 1 from inventory.project_equipment pe
          join inventory.projects p on p.id = pe.project_id
          where pe.equipment_id = equipment.id and p.status = 'Активен'
        ) then 'project'
        else 'room'
      end as context
    from inventory.equipment equipment
    left join lateral (
      select h.status, h.responsible
      from inventory.equipment_history h
      where h.equipment_id = equipment.id
      order by h.recorded_at desc, h.id desc
      limit 1
    ) history on true
    where equipment.room_id in (select id from scoped_rooms)
      and coalesce(history.status, 'На Складе') <> 'Списано'
  )
  insert into inventory.inventory_session_items (
    session_id, equipment_id, expected_room_id, expected_status, expected_responsible, expected_context, result
  )
  select
    v_session_id, id, room_id, status, responsible, context,
    case when context = 'room' then 'pending' else 'accounted_elsewhere' end
  from expected;

  return v_session_id;
end;
$$;

create or replace function inventory.scan_inventory_item(
  p_session_id uuid,
  p_code text,
  p_actual_room_id uuid
)
returns table (equipment_id text, result text, duplicate boolean)
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_equipment_id text;
  v_item inventory.inventory_session_items%rowtype;
  v_result text;
begin
  perform inventory.assert_custody_editor();

  if nullif(btrim(p_code), '') is null or not exists (
    select 1 from inventory.inventory_sessions s
    where s.id = p_session_id and s.status = 'in_progress'
  ) then
    raise exception using errcode = '22023', message = 'INVENTORY_SESSION_NOT_ACTIVE';
  end if;

  select e.id into v_equipment_id
    from inventory.equipment e
   where lower(e.id) = lower(btrim(p_code))
      or lower(coalesce(e.inv_number, '')) = lower(btrim(p_code))
   order by case when lower(e.id) = lower(btrim(p_code)) then 0 else 1 end
   limit 1;

  if v_equipment_id is null then
    insert into inventory.inventory_scans (session_id, raw_code, actual_room_id, result)
    values (p_session_id, btrim(p_code), p_actual_room_id, 'unknown');
    return query select null::text, 'unknown'::text, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text || ':' || v_equipment_id, 0));

  select * into v_item
    from inventory.inventory_session_items i
   where i.session_id = p_session_id and i.equipment_id = v_equipment_id
   for update;

  if found and v_item.scanned_at is not null then
    insert into inventory.inventory_scans (session_id, raw_code, equipment_id, actual_room_id, result)
    values (p_session_id, btrim(p_code), v_equipment_id, p_actual_room_id, 'duplicate');
    return query select v_equipment_id, 'duplicate'::text, true;
    return;
  end if;

  if not found then
    v_result := 'unexpected';
    insert into inventory.inventory_session_items (
      session_id, equipment_id, expected_status, expected_responsible, expected_context,
      result, actual_room_id, scanned_by, scanned_at
    ) values (
      p_session_id, v_equipment_id, '', '', 'unexpected',
      v_result, p_actual_room_id, auth.uid(), now()
    );
  else
    v_result := case
      when v_item.expected_context <> 'room' then 'misplaced'
      when v_item.expected_room_id = p_actual_room_id then 'found'
      else 'misplaced'
    end;
    update inventory.inventory_session_items
       set result = v_result, actual_room_id = p_actual_room_id,
           scanned_by = auth.uid(), scanned_at = now()
     where id = v_item.id;
  end if;

  insert into inventory.inventory_scans (session_id, raw_code, equipment_id, actual_room_id, result)
  values (p_session_id, btrim(p_code), v_equipment_id, p_actual_room_id, v_result);

  return query select v_equipment_id, v_result, false;
end;
$$;

create or replace function inventory.finish_inventory_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_missing integer;
begin
  perform inventory.assert_custody_editor();

  update inventory.inventory_sessions
     set status = 'completed', completed_at = now()
   where id = p_session_id and status = 'in_progress';
  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_SESSION_NOT_ACTIVE';
  end if;

  update inventory.inventory_session_items
     set result = 'missing'
   where session_id = p_session_id and result = 'pending';
  get diagnostics v_missing = row_count;
  return v_missing;
end;
$$;

create or replace function inventory.cancel_inventory_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = inventory, public
as $$
begin
  perform inventory.assert_custody_editor();
  update inventory.inventory_sessions
     set status = 'cancelled', completed_at = now()
   where id = p_session_id and status in ('draft', 'in_progress');
  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_SESSION_NOT_ACTIVE';
  end if;
end;
$$;

revoke all on table inventory.inventory_sessions, inventory.inventory_session_items, inventory.inventory_scans from anon;
revoke insert, update, delete on table inventory.inventory_sessions, inventory.inventory_session_items, inventory.inventory_scans from authenticated;
grant select on table inventory.inventory_sessions, inventory.inventory_session_items, inventory.inventory_scans to authenticated;
revoke all on function inventory.create_inventory_session(text, uuid, boolean, text) from public, anon;
revoke all on function inventory.scan_inventory_item(uuid, text, uuid) from public, anon;
revoke all on function inventory.finish_inventory_session(uuid) from public, anon;
revoke all on function inventory.cancel_inventory_session(uuid) from public, anon;
grant execute on function inventory.create_inventory_session(text, uuid, boolean, text) to authenticated;
grant execute on function inventory.scan_inventory_item(uuid, text, uuid) to authenticated;
grant execute on function inventory.finish_inventory_session(uuid) to authenticated;
grant execute on function inventory.cancel_inventory_session(uuid) to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['inventory_sessions', 'inventory_session_items', 'inventory_scans'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'inventory' and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table %I.%I', 'inventory', target_table);
    end if;
  end loop;
end;
$$;
