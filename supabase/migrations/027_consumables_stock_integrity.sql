-- Serialize consumable stock changes and reject partial/negative withdrawals.
create or replace function inventory.apply_consumable_transaction()
returns trigger
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  current_quantity integer;
begin
  select quantity
    into current_quantity
    from inventory.consumables
   where id = new.consumable_id
   for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'INVENTORY_CONSUMABLE_NOT_FOUND';
  end if;

  if new.type = 'in' then
    update inventory.consumables
       set quantity = current_quantity + new.delta
     where id = new.consumable_id;
  else
    if current_quantity < new.delta then
      raise exception using
        errcode = 'P0001',
        message = 'INVENTORY_INSUFFICIENT_STOCK',
        detail = format('available=%s requested=%s', current_quantity, new.delta);
    end if;

    update inventory.consumables
       set quantity = current_quantity - new.delta
     where id = new.consumable_id;
  end if;

  return new;
end;
$$;
