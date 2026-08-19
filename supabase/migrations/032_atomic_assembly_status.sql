-- Change composite-equipment assembly status and append its status history atomically.
create or replace function inventory.set_equipment_assembly_status(
  p_equipment_id text,
  p_assembly_status text
)
returns void
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_responsible text;
  v_location text;
begin
  if inventory.current_user_role() not in ('admin', 'operator') then
    raise exception using errcode = '42501', message = 'INVENTORY_ASSEMBLY_STATUS_FORBIDDEN';
  end if;

  if nullif(btrim(p_equipment_id), '') is null
     or p_assembly_status is null
     or p_assembly_status not in ('assembling', 'ready', 'synced') then
    raise exception using errcode = '22023', message = 'INVENTORY_ASSEMBLY_STATUS_INVALID';
  end if;

  select responsible
  into v_responsible
  from inventory.equipment
  where id = btrim(p_equipment_id)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_EQUIPMENT_NOT_FOUND';
  end if;

  update inventory.equipment
  set assembly_status = p_assembly_status
  where id = btrim(p_equipment_id);

  if p_assembly_status = 'assembling' then
    select location
    into v_location
    from inventory.equipment_history
    where equipment_id = btrim(p_equipment_id)
    order by recorded_at desc, id desc
    limit 1;

    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    values (
      btrim(p_equipment_id),
      'Комплектуется',
      coalesce(v_location, 'Склад'),
      coalesce(v_responsible, '')
    );
  elsif p_assembly_status = 'ready' then
    insert into inventory.equipment_history (equipment_id, status, location, responsible)
    values (btrim(p_equipment_id), 'На Складе', 'Склад', coalesce(v_responsible, ''));
  end if;
end;
$$;

revoke all on function inventory.set_equipment_assembly_status(text, text)
from public, anon;

grant execute on function inventory.set_equipment_assembly_status(text, text)
to authenticated;
