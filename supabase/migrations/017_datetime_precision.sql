-- Перевод дат проектов и займов с date на timestamptz
-- Существующие записи получают время 00:00:00 UTC (поведение сохраняется)

alter table public.projects
  alter column start_date type timestamptz using start_date::timestamptz,
  alter column end_date   type timestamptz using end_date::timestamptz;

alter table public.equipment_loans
  alter column start_date type timestamptz using start_date::timestamptz,
  alter column due_date   type timestamptz using due_date::timestamptz;
