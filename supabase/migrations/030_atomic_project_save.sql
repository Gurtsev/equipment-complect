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
