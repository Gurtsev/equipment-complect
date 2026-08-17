-- Списки становятся переиспользуемыми шаблонами, а не принадлежат одному
-- проекту/займу. Источник каждого импорта сохраняется в истории проекта.

alter table inventory.project_history
  drop constraint if exists project_history_action_check;

alter table inventory.project_history
  add constraint project_history_action_check check (action in (
    'equipment_added', 'equipment_removed', 'activated', 'finished',
    'created', 'updated', 'list_imported'
  ));

alter table inventory.project_history
  add column list_id uuid references inventory.equipment_lists(id) on delete set null,
  add column list_name text,
  add column imported_count integer,
  add column skipped_count integer;

-- Сохраняем уже существующие связи как записи истории до удаления колонок.
insert into inventory.project_history (
  project_id, action, list_id, list_name, imported_count, skipped_count
)
select
  l.project_id,
  'list_imported',
  l.id,
  l.name,
  (select count(*) from inventory.equipment_list_items li where li.list_id = l.id),
  0
from inventory.equipment_lists l
where l.project_id is not null;

drop index if exists inventory.equipment_lists_project_idx;
drop index if exists inventory.equipment_lists_loan_idx;

alter table inventory.equipment_lists
  drop constraint if exists equipment_lists_check;

alter table inventory.equipment_lists
  drop column if exists project_id,
  drop column if exists loan_id;

