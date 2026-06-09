-- Корзина: одна на пользователя, временная (до конвертации в Список)
create table inventory.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table inventory.cart_items (
  id           uuid primary key default gen_random_uuid(),
  cart_id      uuid not null references inventory.carts(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  added_at     timestamptz not null default now(),
  unique (cart_id, equipment_id)
);

-- Списки: постоянные, прикрепляются к проекту или займу (взаимоисключающе)
create table inventory.equipment_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  user_id     uuid not null references auth.users(id),
  project_id  text references inventory.projects(id) on delete set null,
  loan_id     uuid references inventory.equipment_loans(id) on delete set null,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (project_id is null or loan_id is null)
);

create table inventory.equipment_list_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references inventory.equipment_lists(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  added_at     timestamptz not null default now(),
  unique (list_id, equipment_id)
);

-- Уведомления о конфликтах займов
-- (когда проект вытеснил позицию из займа из-за пересечения дат)
create table inventory.loan_conflict_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  loan_id      uuid not null references inventory.equipment_loans(id) on delete cascade,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  project_id   text not null references inventory.projects(id) on delete cascade,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Индексы
create index cart_items_cart_idx           on inventory.cart_items(cart_id);
create index list_items_list_idx           on inventory.equipment_list_items(list_id);
create index list_items_equipment_idx      on inventory.equipment_list_items(equipment_id);
create index equipment_lists_project_idx   on inventory.equipment_lists(project_id) where project_id is not null;
create index equipment_lists_loan_idx      on inventory.equipment_lists(loan_id) where loan_id is not null;
create index loan_conflict_user_idx        on inventory.loan_conflict_events(user_id, is_read);

-- RLS
alter table inventory.carts               enable row level security;
alter table inventory.cart_items          enable row level security;
alter table inventory.equipment_lists     enable row level security;
alter table inventory.equipment_list_items enable row level security;
alter table inventory.loan_conflict_events enable row level security;

-- carts: только своя корзина
create policy "carts_own" on inventory.carts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- cart_items: доступ через cart.user_id
create policy "cart_items_own" on inventory.cart_items
  for all to authenticated
  using (exists (select 1 from inventory.carts where id = cart_id and user_id = auth.uid()))
  with check (exists (select 1 from inventory.carts where id = cart_id and user_id = auth.uid()));

-- equipment_lists: читают все, меняют владелец / admin / operator
create policy "lists_select" on inventory.equipment_lists
  for select to authenticated using (true);

create policy "lists_insert" on inventory.equipment_lists
  for insert to authenticated with check (user_id = auth.uid());

create policy "lists_update" on inventory.equipment_lists
  for update to authenticated
  using (user_id = auth.uid() or inventory.current_user_role() in ('admin', 'operator'));

create policy "lists_delete" on inventory.equipment_lists
  for delete to authenticated
  using (user_id = auth.uid() or inventory.current_user_role() = 'admin');

-- equipment_list_items: читают все, меняют владелец списка / admin / operator
create policy "list_items_select" on inventory.equipment_list_items
  for select to authenticated using (true);

create policy "list_items_write" on inventory.equipment_list_items
  for all to authenticated
  using (exists (
    select 1 from inventory.equipment_lists l
    where l.id = list_id
      and (l.user_id = auth.uid() or inventory.current_user_role() in ('admin', 'operator'))
  ))
  with check (exists (
    select 1 from inventory.equipment_lists l
    where l.id = list_id
      and (l.user_id = auth.uid() or inventory.current_user_role() in ('admin', 'operator'))
  ));

-- loan_conflict_events: видит только адресат, создают admin / operator
create policy "conflict_events_select" on inventory.loan_conflict_events
  for select to authenticated using (user_id = auth.uid());

create policy "conflict_events_insert" on inventory.loan_conflict_events
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "conflict_events_update" on inventory.loan_conflict_events
  for update to authenticated using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table inventory.carts;
alter publication supabase_realtime add table inventory.cart_items;
alter publication supabase_realtime add table inventory.equipment_lists;
alter publication supabase_realtime add table inventory.equipment_list_items;
alter publication supabase_realtime add table inventory.loan_conflict_events;
