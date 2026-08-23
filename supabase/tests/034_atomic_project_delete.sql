-- Regression test for migration 034. Run only against a disposable database.
begin;

create or replace function auth.uid()
returns uuid language sql stable
as $$ select '00000000-0000-0000-0000-000000000034'::uuid $$;

insert into auth.users (id, email, raw_user_meta_data)
values (auth.uid(), 'migration-034@megapolis.media', '{"name":"Migration 034"}'::jsonb);
update inventory.profiles set role = 'operator', is_active = true where id = auth.uid();
set local role authenticated;

select inventory.create_equipment_with_history(
  'M034-EQ-1', 'Delete fixture', '', 'camera', 'tech', '', '', 'M034-INV-1', '',
  'Migration 034', '{}'::text[], null, null, 1, null, null
);
select inventory.create_project_with_equipment(
  'M034-P1', 'Planned delete', '', now() + interval '1 day', now() + interval '2 days',
  'Studio', 'Migration 034', 'Планируется', '', array['M034-EQ-1']
);

select inventory.delete_project('M034-P1');

do $$
begin
  if exists (select 1 from inventory.projects where id = 'M034-P1')
     or exists (select 1 from inventory.project_equipment where project_id = 'M034-P1')
     or (select status from inventory.equipment_history where equipment_id = 'M034-EQ-1' order by recorded_at desc, id desc limit 1) <> 'На Складе' then
    raise exception 'M034_PLANNED_DELETE_ASSERTION_FAILED';
  end if;
end;
$$;

select inventory.create_project_with_equipment(
  'M034-P2', 'Active delete guard', '', now() - interval '1 hour', now() + interval '1 day',
  'Studio', 'Migration 034', 'Планируется', '', array['M034-EQ-1']
);
select inventory.transition_project('M034-P2', 'Активен');

do $$
begin
  begin
    perform inventory.delete_project('M034-P2');
    raise exception 'M034_EXPECTED_ACTIVE_DELETE_REJECTION';
  exception when others then
    if sqlerrm = 'M034_EXPECTED_ACTIVE_DELETE_REJECTION'
       or position('INVENTORY_PROJECT_DELETE_ACTIVE' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  if not exists (select 1 from inventory.projects where id = 'M034-P2' and status = 'Активен')
     or (select status from inventory.equipment_history where equipment_id = 'M034-EQ-1' order by recorded_at desc, id desc limit 1) <> 'В Работе' then
    raise exception 'M034_ACTIVE_DELETE_CHANGED_STATE';
  end if;
end;
$$;

select inventory.transition_project('M034-P2', 'Завершён');
select inventory.delete_project('M034-P2');

do $$
begin
  if exists (select 1 from inventory.projects where id = 'M034-P2') then
    raise exception 'M034_COMPLETED_DELETE_ASSERTION_FAILED';
  end if;
end;
$$;

rollback;
