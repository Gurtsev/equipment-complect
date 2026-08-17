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
