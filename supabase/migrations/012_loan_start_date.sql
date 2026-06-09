-- Дата начала займа (null = начинается в день оформления)
alter table inventory.equipment_loans
  add column if not exists start_date date;
