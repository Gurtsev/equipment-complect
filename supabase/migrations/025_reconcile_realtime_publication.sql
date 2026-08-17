-- Фиксирует Realtime-контракт frontend в схеме inventory.
-- На production часть таблиц могла быть добавлена вручную, поэтому миграция
-- идемпотентна и добавляет только отсутствующие таблицы.

do $$
declare
  target_table text;
  realtime_tables text[] := array[
    'equipment',
    'equipment_history',
    'projects',
    'project_equipment',
    'project_history',
    'employee_assignments',
    'consumables',
    'consumable_transactions',
    'equipment_loans',
    'cart_items',
    'equipment_lists',
    'equipment_list_items',
    'rooms'
  ];
begin
  foreach target_table in array realtime_tables loop
    if not exists (
      select 1
      from pg_publication_tables ppt
      where ppt.pubname = 'supabase_realtime'
        and ppt.schemaname = 'inventory'
        and ppt.tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table %I.%I',
        'inventory',
        target_table
      );
    end if;
  end loop;
end
$$;

