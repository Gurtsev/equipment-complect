# Применение миграции 031: атомарное создание оборудования

Миграция `031_atomic_equipment_create.sql` применяется после `001`–`030`.
Она добавляет RPC `create_equipment_with_history`, которая создаёт карточку
оборудования и первую запись истории в одной PostgreSQL-транзакции.

Текущий frontend продолжает работать до применения 031. Переключать frontend на
новую RPC нужно отдельным коммитом только после production-применения миграции.

## Перед применением

1. Сделать backup базы.
2. Убедиться, что миграции `001`–`030` уже применены.

## Применение

Выполнить `supabase/migrations/031_atomic_equipment_create.sql` в Supabase SQL Editor.

## Проверка

```sql
select routine_name
from information_schema.routines
where routine_schema = 'inventory'
  and routine_name = 'create_equipment_with_history';

select has_function_privilege(
  'authenticated',
  'inventory.create_equipment_with_history(text,text,text,text,text,text,text,text,text,text,text[],uuid,jsonb,integer,text,text)',
  'execute'
);

select has_function_privilege(
  'anon',
  'inventory.create_equipment_with_history(text,text,text,text,text,text,text,text,text,text,text[],uuid,jsonb,integer,text,text)',
  'execute'
);
```

Ожидается: функция найдена; `authenticated = true`, `anon = false`.
