# Применение миграции 032: атомарный статус сборки

Миграция `032_atomic_assembly_status.sql` применяется после `001`–`031`.
Она добавляет RPC `set_equipment_assembly_status`, которая обновляет
`assembly_status` и создаёт соответствующую запись истории в одной
PostgreSQL-транзакции.

Порядок rolling deploy: сначала применить 032, затем отдельным коммитом
перевести frontend на RPC. Так предыдущая версия frontend остаётся совместимой
во время применения SQL.

## Перед применением

1. Сделать backup базы.
2. Убедиться, что миграции `001`–`031` уже применены.

## Применение

Выполнить `supabase/migrations/032_atomic_assembly_status.sql` в Supabase SQL Editor.

## Проверка

```sql
select routine_name
from information_schema.routines
where routine_schema = 'inventory'
  and routine_name = 'set_equipment_assembly_status';

select has_function_privilege(
  'authenticated',
  'inventory.set_equipment_assembly_status(text,text)',
  'execute'
);

select has_function_privilege(
  'anon',
  'inventory.set_equipment_assembly_status(text,text)',
  'execute'
);
```

Ожидается: функция найдена; `authenticated = true`, `anon = false`.
