-- Regression test for migration 030. Run only against a disposable database.
-- Every fixture and auth helper override is rolled back at the end.
begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '00000000-0000-0000-0000-000000000030'::uuid $$;

insert into auth.users (id, email, raw_user_meta_data)
values (
  auth.uid(),
  'migration-030@megapolis.media',
  '{"name":"Migration 030"}'::jsonb
);

update inventory.profiles
set role = 'operator', is_active = true
where id = auth.uid();

insert into inventory.equipment (id, model, category, responsible)
values
  ('M030-EQ-1', 'Migration camera 1', 'camera', 'Migration 030'),
  ('M030-EQ-2', 'Migration camera 2', 'camera', 'Migration 030'),
  ('M030-EQ-3', 'Migration camera 3', 'camera', 'Migration 030');

insert into inventory.equipment_lists (id, name, user_id)
values (
  '00000000-0000-0000-0000-000000000031'::uuid,
  'Migration list',
  '00000000-0000-0000-0000-000000000030'::uuid
);

-- Exercise the same grants and RLS role used by the browser client.
set local role authenticated;

select inventory.create_project_with_equipment(
  'M030-P1',
  'Migration project 1',
  '',
  '2030-01-10 09:00:00+03',
  '2030-01-12 18:00:00+03',
  'Романов',
  'Migration 030',
  'Планируется',
  '',
  array['M030-EQ-1']
);

do $$
begin
  if (select count(*) from inventory.projects where id = 'M030-P1') <> 1
     or (select count(*) from inventory.project_equipment where project_id = 'M030-P1') <> 1
     or (select count(*) from inventory.project_history where project_id = 'M030-P1' and action = 'created') <> 1
     or (select status from inventory.equipment_history where equipment_id = 'M030-EQ-1' order by recorded_at desc, id desc limit 1) <> 'Забронировано' then
    raise exception 'M030_CREATE_ASSERTION_FAILED';
  end if;
end;
$$;

do $$
begin
  begin
    perform inventory.create_project_with_equipment(
      'M030-CONFLICT',
      'Conflicting project',
      '',
      '2030-01-11 09:00:00+03',
      '2030-01-13 18:00:00+03',
      'Романов',
      'Migration 030',
      'Планируется',
      '',
      array['M030-EQ-1']
    );
    raise exception 'M030_EXPECTED_PROJECT_CONFLICT';
  exception when others then
    if sqlerrm = 'M030_EXPECTED_PROJECT_CONFLICT'
       or position('INVENTORY_PROJECT_PERIOD_CONFLICT' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  if exists (select 1 from inventory.projects where id = 'M030-CONFLICT') then
    raise exception 'M030_CONFLICT_WAS_NOT_ROLLED_BACK';
  end if;
end;
$$;

select inventory.create_project_with_equipment(
  'M030-P2',
  'Migration project 2',
  '',
  '2030-01-10 09:00:00+03',
  '2030-01-12 18:00:00+03',
  'Знаменка',
  'Migration 030',
  'Планируется',
  '',
  array['M030-EQ-2']
);

insert into inventory.equipment_loans (
  equipment_id, loan_type, to_profile_id, start_date, due_date
) values (
  'M030-EQ-3',
  'employee',
  '00000000-0000-0000-0000-000000000030'::uuid,
  now() - interval '1 hour',
  now() + interval '1 hour'
);

do $$
declare
  closed_count integer;
begin
  closed_count := inventory.add_project_equipment(
    'M030-P1',
    array['M030-EQ-3'],
    '00000000-0000-0000-0000-000000000031'::uuid,
    'Migration list',
    2
  );

  if closed_count <> 1
     or exists (
       select 1 from inventory.equipment_loans
       where equipment_id = 'M030-EQ-3' and returned_at is null
     )
     or not exists (
       select 1 from inventory.project_equipment
       where project_id = 'M030-P1' and equipment_id = 'M030-EQ-3'
     )
     or not exists (
       select 1 from inventory.project_history
       where project_id = 'M030-P1'
         and action = 'list_imported'
         and imported_count = 1
         and skipped_count = 2
     ) then
    raise exception 'M030_ADD_ASSERTION_FAILED';
  end if;
end;
$$;

select inventory.transition_project('M030-P1', 'Активен');

do $$
begin
  if (select status from inventory.projects where id = 'M030-P1') <> 'Активен'
     or (select status from inventory.equipment_history where equipment_id = 'M030-EQ-1' order by recorded_at desc, id desc limit 1) <> 'В Работе'
     or (select count(*) from inventory.project_history where project_id = 'M030-P1' and action = 'activated') <> 1 then
    raise exception 'M030_ACTIVATE_ASSERTION_FAILED';
  end if;
end;
$$;

select inventory.remove_project_equipment('M030-P1', array['M030-EQ-3']);

do $$
begin
  if exists (
       select 1 from inventory.project_equipment
       where project_id = 'M030-P1' and equipment_id = 'M030-EQ-3'
     )
     or (select status from inventory.equipment_history where equipment_id = 'M030-EQ-3' order by recorded_at desc, id desc limit 1) <> 'На Складе'
     or (select count(*) from inventory.project_history where project_id = 'M030-P1' and action = 'equipment_removed') <> 1 then
    raise exception 'M030_REMOVE_ASSERTION_FAILED';
  end if;
end;
$$;

select inventory.transition_project('M030-P1', 'Завершён');

do $$
begin
  if (select status from inventory.projects where id = 'M030-P1') <> 'Завершён'
     or exists (select 1 from inventory.project_equipment where project_id = 'M030-P1')
     or (select status from inventory.equipment_history where equipment_id = 'M030-EQ-1' order by recorded_at desc, id desc limit 1) <> 'На Складе'
     or (select count(*) from inventory.project_history where project_id = 'M030-P1' and action = 'finished') <> 1 then
    raise exception 'M030_FINISH_ASSERTION_FAILED';
  end if;
end;
$$;

select inventory.update_project_with_equipment(
  'M030-P2',
  'Migration project 2 updated',
  '',
  '2030-01-10 09:00:00+03',
  '2030-01-12 18:00:00+03',
  'Знаменка',
  'Migration 030',
  'Планируется',
  'Updated atomically',
  array['M030-EQ-2']
);

do $$
begin
  if (select name from inventory.projects where id = 'M030-P2') <> 'Migration project 2 updated'
     or (select count(*) from inventory.project_history where project_id = 'M030-P2' and action = 'updated') <> 1 then
    raise exception 'M030_UPDATE_ASSERTION_FAILED';
  end if;
end;
$$;

do $$
begin
  begin
    perform inventory.update_project_with_equipment(
      'M030-P2',
      'Migration project 2',
      '',
      '2030-01-10 09:00:00+03',
      '2030-01-12 18:00:00+03',
      'Знаменка',
      'Migration 030',
      'Активен',
      '',
      array['M030-EQ-2']
    );
    raise exception 'M030_EXPECTED_INVALID_TRANSITION';
  exception when others then
    if sqlerrm = 'M030_EXPECTED_INVALID_TRANSITION'
       or position('INVENTORY_PROJECT_INVALID_TRANSITION' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$$;

rollback;
