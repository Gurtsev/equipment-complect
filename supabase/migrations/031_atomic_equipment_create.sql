-- Create an equipment card and its initial history entry atomically.
create or replace function inventory.create_equipment_with_history(
  p_id text,
  p_model text,
  p_subtitle text,
  p_category text,
  p_section text,
  p_description text,
  p_image text,
  p_inv_number text,
  p_serial_number text,
  p_responsible text,
  p_accessories text[],
  p_room_id uuid,
  p_attributes jsonb,
  p_quantity integer,
  p_parent_id text,
  p_assembly_status text
)
returns text
language plpgsql
security definer
set search_path = inventory, public
as $$
begin
  if inventory.current_user_role() not in ('admin', 'operator') then
    raise exception using errcode = '42501', message = 'INVENTORY_EQUIPMENT_CREATE_FORBIDDEN';
  end if;

  if nullif(btrim(p_id), '') is null or nullif(btrim(p_model), '') is null then
    raise exception using errcode = '22023', message = 'INVENTORY_EQUIPMENT_REQUIRED_FIELD';
  end if;

  insert into inventory.equipment (
    id,
    model,
    subtitle,
    category,
    section,
    description,
    image,
    inv_number,
    serial_number,
    responsible,
    accessories,
    room_id,
    attributes,
    quantity,
    parent_id,
    assembly_status
  ) values (
    btrim(p_id),
    btrim(p_model),
    coalesce(btrim(p_subtitle), ''),
    p_category,
    p_section,
    coalesce(btrim(p_description), ''),
    coalesce(btrim(p_image), ''),
    nullif(btrim(p_inv_number), ''),
    coalesce(btrim(p_serial_number), ''),
    coalesce(btrim(p_responsible), ''),
    coalesce(p_accessories, '{}'::text[]),
    p_room_id,
    p_attributes,
    p_quantity,
    p_parent_id,
    p_assembly_status
  );

  insert into inventory.equipment_history (equipment_id, status, location, responsible)
  values (btrim(p_id), 'На Складе', 'Склад', coalesce(btrim(p_responsible), ''));

  return btrim(p_id);
end;
$$;

revoke all on function inventory.create_equipment_with_history(
  text, text, text, text, text, text, text, text, text, text,
  text[], uuid, jsonb, integer, text, text
) from public, anon;

grant execute on function inventory.create_equipment_with_history(
  text, text, text, text, text, text, text, text, text, text,
  text[], uuid, jsonb, integer, text, text
) to authenticated;
