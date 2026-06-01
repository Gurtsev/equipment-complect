alter table public.rooms
  add column if not exists responsible text not null default '';
