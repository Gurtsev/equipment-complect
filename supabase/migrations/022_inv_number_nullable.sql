-- Инвентарный номер стал необязательным во фронтенде (commit 6a226a7b),
-- но колонка осталась `not null unique` — две карточки без номера (`''`)
-- конфликтуют по уникальному ограничению (23505). NULL в Postgres не
-- конфликтует с NULL под unique-индексом, поэтому делаем колонку nullable
-- и храним отсутствие номера как NULL вместо ''.

alter table inventory.equipment alter column inv_number drop not null;

update inventory.equipment set inv_number = null where inv_number = '';
