-- Дата начала займа (null = начинается в день оформления)
alter table public.equipment_loans
  add column if not exists start_date date;
