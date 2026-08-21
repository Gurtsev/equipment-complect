-- Regression test for migration 033. Run only against a disposable database.
begin;

create or replace function auth.uid()
returns uuid language sql stable
as $$ select '00000000-0000-0000-0000-000000000033'::uuid $$;

insert into auth.users (id, email, raw_user_meta_data)
values (auth.uid(), 'migration-033@megapolis.media', '{"name":"Migration 033"}'::jsonb);
update inventory.profiles set role = 'operator', is_active = true where id = auth.uid();
set local role authenticated;

select inventory.create_equipment_with_history(
  'M033-EQ-1', 'Expected fixture', '', 'camera', 'tech', '', '', 'M033-INV-1', '',
  'Migration 033', '{}'::text[], (select id from inventory.rooms where code = 'B-01-03-01'), null, 1, null, null
);
select inventory.create_equipment_with_history(
  'M033-EQ-2', 'Missing fixture', '', 'camera', 'tech', '', '', 'M033-INV-2', '',
  'Migration 033', '{}'::text[], (select id from inventory.rooms where code = 'B-01-03-01'), null, 1, null, null
);
select inventory.create_equipment_with_history(
  'M033-EQ-3', 'Unexpected fixture', '', 'camera', 'tech', '', '', 'M033-INV-3', '',
  'Migration 033', '{}'::text[], (select id from inventory.rooms where code = 'C-01-02-01'), null, 1, null, null
);

create temporary table m033_session (id uuid not null);
insert into m033_session
select inventory.create_inventory_session(
  'Migration 033 session', (select id from inventory.rooms where code = 'B-01-03'), true, ''
);

select * from inventory.scan_inventory_item(
  (select id from m033_session), 'M033-INV-1', (select id from inventory.rooms where code = 'B-01-03-01')
);
select * from inventory.scan_inventory_item(
  (select id from m033_session), 'M033-EQ-1', (select id from inventory.rooms where code = 'B-01-03-01')
);
select * from inventory.scan_inventory_item(
  (select id from m033_session), 'M033-EQ-3', (select id from inventory.rooms where code = 'B-01-03-01')
);
select * from inventory.scan_inventory_item(
  (select id from m033_session), 'UNKNOWN-033', (select id from inventory.rooms where code = 'B-01-03-01')
);
select inventory.finish_inventory_session((select id from m033_session));

do $$
declare
  sid uuid := (select id from m033_session);
begin
  if (select status from inventory.inventory_sessions where id = sid) <> 'completed'
     or (select result from inventory.inventory_session_items where session_id = sid and equipment_id = 'M033-EQ-1') <> 'found'
     or (select result from inventory.inventory_session_items where session_id = sid and equipment_id = 'M033-EQ-2') <> 'missing'
     or (select result from inventory.inventory_session_items where session_id = sid and equipment_id = 'M033-EQ-3') <> 'unexpected'
     or (select count(*) from inventory.inventory_scans where session_id = sid and result = 'duplicate') <> 1
     or (select count(*) from inventory.inventory_scans where session_id = sid and result = 'unknown') <> 1 then
    raise exception 'M033_INVENTORY_SESSION_ASSERTION_FAILED';
  end if;
end;
$$;

rollback;
