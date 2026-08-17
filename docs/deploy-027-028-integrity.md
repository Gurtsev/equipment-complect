# Применение миграций 027–028: целостность операций

Миграции применяются после `001`–`026`, по порядку:

1. `027_consumables_stock_integrity.sql`;
2. `028_equipment_custody_integrity.sql`.

Frontend совместим с состоянием до миграций, но серверная защита от конкурентных
операций появляется только после их применения.

## Перед применением

1. Создать резервную копию БД.
2. Убедиться, что нет открытых конфликтующих записей:

```sql
-- Несколько открытых постоянных выдач одной единицы.
select equipment_id, count(*)
from inventory.employee_assignments
where returned_at is null
group by equipment_id
having count(*) > 1;

-- Одновременно открытая постоянная выдача и займ.
select assignment.equipment_id, assignment.id as assignment_id, loan.id as loan_id
from inventory.employee_assignments assignment
join inventory.equipment_loans loan using (equipment_id)
where assignment.returned_at is null
  and loan.returned_at is null;

-- Некорректные периоды открытых займов.
select id, equipment_id, start_date, due_date
from inventory.equipment_loans
where returned_at is null
  and due_date is not null
  and due_date <= coalesce(start_date, issued_at);

-- Пересекающиеся открытые займы одной единицы.
select first_loan.equipment_id,
       first_loan.id as first_loan_id,
       second_loan.id as second_loan_id
from inventory.equipment_loans first_loan
join inventory.equipment_loans second_loan
  on second_loan.equipment_id = first_loan.equipment_id
 and second_loan.id > first_loan.id
where first_loan.returned_at is null
  and second_loan.returned_at is null
  and coalesce(first_loan.start_date, first_loan.issued_at)
      < coalesce(second_loan.due_date, 'infinity'::timestamptz)
  and coalesce(second_loan.start_date, second_loan.issued_at)
      < coalesce(first_loan.due_date, 'infinity'::timestamptz);
```

Все четыре запроса должны вернуть ноль строк. Если найдены конфликты, сначала
проверить их с владельцем оборудования и закрыть ошибочные записи через штатный
интерфейс. Миграция 028 намеренно остановится, если конфликтующие данные останутся.

## Проверка после применения

```sql
select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'inventory'
  and trigger_name in (
    'ensure_assignment_custody_available',
    'ensure_loan_custody_available'
  )
order by trigger_name;

select indexname
from pg_indexes
where schemaname = 'inventory'
  and indexname in (
    'employee_assignments_one_open_per_equipment_idx',
    'equipment_loans_open_equipment_period_idx'
  )
order by indexname;
```

Оба запроса должны вернуть по две строки. Затем проверить через интерфейс:

1. списание расходника больше остатка отклоняется, остаток и журнал не меняются;
2. повторная выдача уже выданной единицы отклоняется;
3. займ на период существующего займа отклоняется;
4. после возврата оборудования новая выдача проходит.

Откат frontend не удаляет триггеры и не требует отката этих миграций.
