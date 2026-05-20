alter table public.equipment
  add column if not exists department text not null default 'studio'
  check (department in ('studio', 'aho', 'office'));
