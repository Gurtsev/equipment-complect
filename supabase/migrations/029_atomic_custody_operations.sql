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
