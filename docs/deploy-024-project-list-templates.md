# Применение миграции 024: списки-шаблоны

Миграцию нужно применить до выкладки frontend, использующего импорт списков.

## Перед применением

1. Создать резервную копию БД.
2. Убедиться, что применены миграции `001`–`023`.
3. Проверить старые привязки:

```sql
select id, name, project_id, loan_id
from inventory.equipment_lists
where project_id is not null or loan_id is not null;
```

Старые связи с проектами будут перенесены в `project_history`. Связи с займами
не переносятся: эта функция не использовалась интерфейсом.

## Применение

Выполнить содержимое:

```text
supabase/migrations/024_project_list_templates.sql
```

## Проверка после применения

```sql
select column_name
from information_schema.columns
where table_schema = 'inventory'
  and table_name = 'equipment_lists'
order by ordinal_position;

select action, list_name, imported_count, skipped_count, recorded_at
from inventory.project_history
where action = 'list_imported'
order by recorded_at desc;
```

В `equipment_lists` больше не должно быть `project_id` и `loan_id`. В
`project_history` должны существовать колонки `list_id`, `list_name`,
`imported_count`, `skipped_count`.

## Проверка интерфейса

1. Создать список из корзины.
2. Открыть планируемый проект и нажать «Из списка».
3. Проверить сравнение доступных, существующих и недоступных позиций.
4. Выполнить импорт и убедиться, что новые позиции появились в проекте.
5. Повторить импорт: дубликаты не должны добавиться.
6. Удалить одну позицию из проекта: исходный список не должен измениться.
7. Проверить запись `list_imported` в истории проекта.

