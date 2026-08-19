-- Regression test for migration 031. Run only against a disposable database.
-- Every fixture and auth helper override is rolled back at the end.
begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '00000000-0000-0000-0000-000000000031'::uuid $$;

insert into auth.users (id, email, raw_user_meta_data)
values (
  auth.uid(),
  'migration-031@megapolis.media',
  '{"name":"Migration 031"}'::jsonb
);

update inventory.profiles
set role = 'operator', is_active = true
where id = auth.uid();

set local role authenticated;

select inventory.create_equipment_with_history(
  'M031-EQ-1',
  'Migration camera',
  'Atomic create',
  'camera',
  'tech',
  'Regression fixture',
  '',
  '',
  'SN-M031',
  'Migration 031',
  array['Battery'],
  null,
  '{"Color":"Black"}'::jsonb,
  1,
  null,
  null
);

do $$
begin
  if (select count(*) from inventory.equipment where id = 'M031-EQ-1') <> 1
     or (select inv_number from inventory.equipment where id = 'M031-EQ-1') is not null
     or (select count(*) from inventory.equipment_history where equipment_id = 'M031-EQ-1') <> 1
     or (select status from inventory.equipment_history where equipment_id = 'M031-EQ-1') <> 'На Складе'
     or (select location from inventory.equipment_history where equipment_id = 'M031-EQ-1') <> 'Склад' then
    raise exception 'M031_ATOMIC_CREATE_ASSERTION_FAILED';
  end if;
end;
$$;

reset role;

update inventory.profiles
set role = 'viewer'
where id = auth.uid();

set local role authenticated;

do $$
begin
  begin
    perform inventory.create_equipment_with_history(
      'M031-FORBIDDEN', 'Forbidden', '', 'camera', 'tech', '', '', '', '', '',
      '{}'::text[], null, null, null, null, null
    );
    raise exception 'M031_EXPECTED_FORBIDDEN';
  exception when others then
    if sqlerrm = 'M031_EXPECTED_FORBIDDEN'
       or position('INVENTORY_EQUIPMENT_CREATE_FORBIDDEN' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  if exists (select 1 from inventory.equipment where id = 'M031-FORBIDDEN') then
    raise exception 'M031_FORBIDDEN_CREATE_WAS_NOT_ROLLED_BACK';
  end if;
end;
$$;

rollback;
