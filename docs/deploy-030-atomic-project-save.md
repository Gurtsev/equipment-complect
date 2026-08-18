# Применение миграции 030: атомарные операции проектов

> Production: миграция применена 2026-08-18 по подтверждению владельца проекта.
> После применения требуется authenticated UI-smoke по сценариям ниже.

Миграция `030_atomic_project_save.sql` применяется после `001`–`029`.

До её применения новый frontend сохраняет совместимость: при отсутствии RPC в
PostgREST schema cache используются прежние запросы. После применения создание и
редактирование, изменение состава, активация и завершение проекта вместе со
статусами оборудования и аудитом выполняются транзакционно.

## Перед применением

1. Сделать backup базы данных.
2. Убедиться, что миграции `024`–`029` уже применены.
3. Проверить существующие пересечения оборудования между незавершёнными проектами:

```sql
select
  first_project.id as first_project_id,
  second_project.id as second_project_id,
  first_membership.equipment_id
from inventory.project_equipment first_membership
join inventory.projects first_project on first_project.id = first_membership.project_id
join inventory.project_equipment second_membership
  on second_membership.equipment_id = first_membership.equipment_id
 and second_membership.project_id > first_membership.project_id
join inventory.projects second_project on second_project.id = second_membership.project_id
where first_project.status <> 'Завершён'
  and second_project.status <> 'Завершён'
  and first_project.start_date <= second_project.end_date
  and second_project.start_date <= first_project.end_date;
```

Запрос может показать исторически допустимые пересечения. Миграция не изменяет
их автоматически, но после её применения не позволит создать новые через RPC.

## Применение

Выполнить `supabase/migrations/030_atomic_project_save.sql` в SQL Editor или
штатном механизме миграций окружения.

## Проверка

```sql
select routine_name
from information_schema.routines
where routine_schema = 'inventory'
  and routine_name in (
    'create_project_with_equipment',
    'update_project_with_equipment',
    'add_project_equipment',
    'remove_project_equipment',
    'transition_project'
  )
order by routine_name;
```

Запрос должен вернуть пять строк. Затем через интерфейс проверить:

1. новый проект создаётся и получает одну запись истории `created`;
2. изменение карточки создаёт одну запись `updated`;
3. добавление и удаление оборудования сохраняет точный состав проекта;
4. оборудование нельзя сохранить в двух пересекающихся по времени проектах;
5. оборудование с назначением сотруднику или пересекающимся займом добавить нельзя;
6. активация одновременно меняет проект, статусы оборудования и историю;
7. завершение одновременно возвращает оборудование, очищает состав и пишет историю;
8. при отклонённой операции карточка, состав и история остаются без изменений.

Для disposable/local базы тот же контракт автоматически проверяет:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/030_atomic_project_operations.sql
```

Тест переключается на роль `authenticated`, выполняет все сценарии внутри одной
транзакции и завершает её через `ROLLBACK`. На production его не запускать.

Откат frontend не требует отката миграции: прямые RLS-запросы остаются доступны
для предыдущей версии клиента.
