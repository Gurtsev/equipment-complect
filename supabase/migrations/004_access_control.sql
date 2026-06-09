-- ─── Таблица разрешённых email / доменов ─────────────────────────────────────

create table if not exists inventory.allowed_emails (
  id         uuid default gen_random_uuid() primary key,
  email      text unique,     -- конкретный адрес (взаимоисключающее с domain)
  domain     text unique,     -- домен без @ (взаимоисключающее с email)
  role       text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  note       text,
  created_at timestamptz default now(),
  constraint allowed_emails_one_field check (
    (email is not null and domain is null) or
    (email is null and domain is not null)
  )
);

-- Домен компании разрешён по умолчанию
insert into inventory.allowed_emails (domain, role, note)
values ('megapolis.media', 'viewer', 'Домен компании')
on conflict do nothing;

-- ─── RLS для allowed_emails ───────────────────────────────────────────────────

alter table inventory.allowed_emails enable row level security;

-- Читать могут все аутентифицированные (нужно для страницы администратора)
create policy "allowed_emails_select" on inventory.allowed_emails
  for select to authenticated using (true);

create policy "allowed_emails_insert" on inventory.allowed_emails
  for insert to authenticated
  with check (inventory.current_user_role() = 'admin');

create policy "allowed_emails_update" on inventory.allowed_emails
  for update to authenticated
  using (inventory.current_user_role() = 'admin');

create policy "allowed_emails_delete" on inventory.allowed_emails
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- ─── Добавляем email в profiles ───────────────────────────────────────────────

alter table inventory.profiles
  add column if not exists email text;

-- ─── Триггер: авто-создание профиля при регистрации ──────────────────────────

create or replace function inventory.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = inventory, public
as $$
declare
  v_email  text;
  v_domain text;
  v_role   text;
  v_name   text;
begin
  v_email  := new.email;
  v_domain := split_part(v_email, '@', 2);
  v_name   := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  -- Приоритет у конкретного email над доменом
  select role into v_role
  from inventory.allowed_emails
  where email = v_email or domain = v_domain
  order by (email is not null) desc
  limit 1;

  if v_role is not null then
    insert into inventory.profiles (id, name, role, email)
    values (new.id, v_name, v_role, v_email)
    on conflict (id) do nothing;
  end if;

  return new;
exception when others then
  return new; -- не блокируем регистрацию при ошибке в триггере
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function inventory.handle_new_user();

-- ─── Обновление политик profiles ─────────────────────────────────────────────

-- admin видит все профили (нужно для страницы управления пользователями)
drop policy if exists "profiles_select" on inventory.profiles;
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (
    id = auth.uid() or inventory.current_user_role() = 'admin'
  );

-- admin меняет роли и имена
create policy "profiles_update" on inventory.profiles
  for update to authenticated
  using (inventory.current_user_role() = 'admin');

-- admin деактивирует (удаляет профиль, auth.users остаётся)
create policy "profiles_delete" on inventory.profiles
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');
