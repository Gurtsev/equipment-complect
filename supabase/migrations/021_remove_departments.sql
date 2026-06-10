-- Удаление концепции "отдел" (department): операторы получают полный доступ,
-- межотдельские займы оборудования упраздняются.

-- ─── equipment: вернуть RLS к проверке только по роли (как в 002_auth.sql) ──

drop policy if exists "equipment_insert" on inventory.equipment;
create policy "equipment_insert" on inventory.equipment
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

drop policy if exists "equipment_update" on inventory.equipment;
create policy "equipment_update" on inventory.equipment
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

-- ─── удаление вспомогательной функции и колонок department ──────────────────

drop function if exists inventory.current_user_department();

alter table inventory.equipment   drop column if exists department;
alter table inventory.profiles    drop column if exists department;
alter table inventory.consumables drop column if exists department;

-- ─── equipment_loans: убрать займы в отдел, оставить только сотрудникам ─────

-- ВНИМАНИЕ: перед выполнением проверьте наличие записей с loan_type = 'department'.
-- Если такие записи есть, их нужно сначала закрыть/мигрировать вручную —
-- ALTER ниже не пройдёт, пока существуют строки, нарушающие новый CHECK.
--   select * from inventory.equipment_loans where loan_type = 'department';

alter table inventory.equipment_loans drop constraint if exists equipment_loans_check;
alter table inventory.equipment_loans drop constraint if exists equipment_loans_loan_type_check;

alter table inventory.equipment_loans drop column if exists to_department;
alter table inventory.equipment_loans drop column if exists from_department;

alter table inventory.equipment_loans
  add constraint equipment_loans_loan_type_check check (loan_type = 'employee');

alter table inventory.equipment_loans
  add constraint equipment_loans_check check (to_profile_id is not null);
