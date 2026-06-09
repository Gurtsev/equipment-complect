-- Расходные материалы
create table inventory.consumables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('hygiene', 'drinks', 'stationery', 'cleaning', 'other')),
  unit text not null default 'шт',
  quantity integer not null default 0 check (quantity >= 0),
  min_threshold integer not null default 0 check (min_threshold >= 0),
  department text check (department in ('studio', 'aho', 'office')),
  notes text,
  created_at timestamptz not null default now()
);

-- Движения по расходным материалам
create table inventory.consumable_transactions (
  id uuid primary key default gen_random_uuid(),
  consumable_id uuid not null references inventory.consumables(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'writeoff')),
  delta integer not null check (delta > 0),
  user_id uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  notes text
);

-- Триггер: обновлять quantity после добавления транзакции
create or replace function inventory.apply_consumable_transaction()
returns trigger language plpgsql security definer set search_path = inventory, public as $$
begin
  if new.type = 'in' then
    update inventory.consumables set quantity = quantity + new.delta where id = new.consumable_id;
  else
    update inventory.consumables set quantity = greatest(0, quantity - new.delta) where id = new.consumable_id;
  end if;
  return new;
end;
$$;

create trigger consumable_transaction_after_insert
after insert on inventory.consumable_transactions
for each row execute function inventory.apply_consumable_transaction();

-- RLS
alter table inventory.consumables enable row level security;
alter table inventory.consumable_transactions enable row level security;

create policy "consumables_select" on inventory.consumables
  for select to authenticated using (true);

create policy "consumables_insert" on inventory.consumables
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "consumables_update" on inventory.consumables
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

create policy "consumables_delete" on inventory.consumables
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

create policy "ctrans_select" on inventory.consumable_transactions
  for select to authenticated using (true);

create policy "ctrans_insert" on inventory.consumable_transactions
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

-- Realtime
alter publication supabase_realtime add table inventory.consumables;
alter publication supabase_realtime add table inventory.consumable_transactions;
