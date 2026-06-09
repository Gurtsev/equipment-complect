-- Supabase linter помечает profile_names как "Security Definer View" (запросы выполняются
-- с правами владельца, а не вызывающего пользователя) — это намеренно (обход RLS на profiles
-- для отображения имён в истории), но идиоматичный и проверяемый паттерн для этого — функция.
drop view if exists inventory.profile_names;

create or replace function inventory.get_profile_names(ids uuid[])
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = inventory, public
as $$
  select id, name from inventory.profiles where id = any(ids)
$$;

grant execute on function inventory.get_profile_names(uuid[]) to authenticated;
