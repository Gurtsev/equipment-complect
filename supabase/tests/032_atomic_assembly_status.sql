-- Regression test for migration 032. Run only against a disposable database.
-- Every fixture and auth helper override is rolled back at the end.
begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '00000000-0000-0000-0000-000000000032'::uuid $$;

insert into auth.users (id, email, raw_user_meta_data)
values (
  auth.uid(),
  'migration-032@megapolis.media',
  '{"name":"Migration 032"}'::jsonb
);

update inventory.profiles
set role = 'operator', is_active = true
where id = auth.uid();

set local role authenticated;

select inventory.create_equipment_with_history(
  'M032-EQ-1', 'Composite fixture', '', 'computer', 'tech', '', '', '', '',
  'Migration 032', '{}'::text[], null, null, 1, null, null
);

select inventory.set_equipment_assembly_status('M032-EQ-1', 'assembling');

do $$
begin
  if (select assembly_status from inventory.equipment where id = 'M032-EQ-1') <> 'assembling'
     or (select count(*) from inventory.equipment_history where equipment_id = 'M032-EQ-1') <> 2
     or (select status from inventory.equipment_history where equipment_id = 'M032-EQ-1' order by recorded_at desc, id desc limit 1) <> 'Комплектуется' then
    raise exception 'M032_ASSEMBLING_ASSERTION_FAILED';
  end if;
end;
$$;

select inventory.set_equipment_assembly_status('M032-EQ-1', 'ready');
select inventory.set_equipment_assembly_status('M032-EQ-1', 'synced');

do $$
begin
  if (select assembly_status from inventory.equipment where id = 'M032-EQ-1') <> 'synced'
     or (select count(*) from inventory.equipment_history where equipment_id = 'M032-EQ-1') <> 3
     or (select status from inventory.equipment_history where equipment_id = 'M032-EQ-1' order by recorded_at desc, id desc limit 1) <> 'На Складе' then
    raise exception 'M032_READY_SYNCED_ASSERTION_FAILED';
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
    perform inventory.set_equipment_assembly_status('M032-EQ-1', 'ready');
    raise exception 'M032_EXPECTED_FORBIDDEN';
  exception when others then
    if sqlerrm = 'M032_EXPECTED_FORBIDDEN'
       or position('INVENTORY_ASSEMBLY_STATUS_FORBIDDEN' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  if (select assembly_status from inventory.equipment where id = 'M032-EQ-1') <> 'synced'
     or (select count(*) from inventory.equipment_history where equipment_id = 'M032-EQ-1') <> 3 then
    raise exception 'M032_FORBIDDEN_CHANGE_WAS_NOT_ROLLED_BACK';
  end if;
end;
$$;

rollback;
