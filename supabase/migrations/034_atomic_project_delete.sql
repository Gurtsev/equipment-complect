-- Delete a non-active project and release its exclusive reservations atomically.
create or replace function inventory.delete_project(p_project_id text)
returns integer
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  target_project inventory.projects%rowtype;
  equipment_ids text[];
  restored_count integer := 0;
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

  if target_project.status = 'Активен' then
    raise exception using errcode = 'P0001', message = 'INVENTORY_PROJECT_DELETE_ACTIVE';
  end if;

  select coalesce(array_agg(membership.equipment_id order by membership.equipment_id), '{}'::text[])
    into equipment_ids
    from inventory.project_equipment membership
   where membership.project_id = p_project_id;

  foreach equipment_id in array equipment_ids loop
    perform pg_advisory_xact_lock(hashtextextended(equipment_id, 0));
  end loop;

  with released as (
    select equipment.id
      from inventory.equipment equipment
      join lateral (
        select history.status
          from inventory.equipment_history history
         where history.equipment_id = equipment.id
         order by history.recorded_at desc, history.id desc
         limit 1
      ) latest on latest.status in ('Забронировано', 'В Работе')
     where equipment.id = any(equipment_ids)
       and not exists (
         select 1
           from inventory.project_equipment other_membership
           join inventory.projects other_project on other_project.id = other_membership.project_id
          where other_membership.equipment_id = equipment.id
            and other_membership.project_id <> p_project_id
            and other_project.status <> 'Завершён'
       )
  ), history_rows as (
    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    select released.id, 'На Складе', 'Склад', target_project.responsible
      from released
    returning equipment_id
  )
  select count(*) into restored_count from history_rows;

  delete from inventory.projects where id = p_project_id;

  return restored_count;
end;
$$;

revoke all on function inventory.delete_project(text) from public, anon;
grant execute on function inventory.delete_project(text) to authenticated;
