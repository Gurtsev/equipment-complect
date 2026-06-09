-- Таблица помещений: 3 уровня через parent_id (Этаж → Помещение → Под-помещение)
create table inventory.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,  -- составной id: A-01-04-01
  office      text not null,         -- 'A' = Романов-96, 'B' = Знаменка-25, 'C' = Знаменка-13
  name        text not null,
  parent_id   uuid references inventory.rooms(id) on delete cascade,
  sort_order  int not null default 0
);

-- RLS
alter table inventory.rooms enable row level security;
create policy "rooms_select" on inventory.rooms for select to authenticated using (true);
create policy "rooms_insert" on inventory.rooms for insert to authenticated
  with check (exists (select 1 from inventory.profiles where id = auth.uid() and role in ('admin', 'operator')));
create policy "rooms_update" on inventory.rooms for update to authenticated
  using (exists (select 1 from inventory.profiles where id = auth.uid() and role in ('admin', 'operator')));
create policy "rooms_delete" on inventory.rooms for delete to authenticated
  using (exists (select 1 from inventory.profiles where id = auth.uid() and role = 'admin'));

-- room_id на оборудовании
alter table inventory.equipment
  add column if not exists room_id uuid references inventory.rooms(id) on delete set null;

-- Индексы
create index rooms_parent_id_idx on inventory.rooms(parent_id);
create index equipment_room_id_idx on inventory.equipment(room_id);

-- ============================================================
-- Предзаполнение: Офис A — Романов-96
-- ============================================================

-- Этажи
insert into inventory.rooms (code, office, name, parent_id, sort_order) values
  ('A-01', 'A', '-1 Этаж', null, 1),
  ('A-02', 'A', '1-й Этаж', null, 2);

-- -1 Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-01', 'A', 'Студия "Подвал"', id, 1 from inventory.rooms where code = 'A-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-02', 'A', 'Студия звукозаписи "Нижняя"', id, 2 from inventory.rooms where code = 'A-01';

-- A-01-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-01-01', 'A', 'Студия "Подвал"', id, 1 from inventory.rooms where code = 'A-01-01';

-- A-01-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-02-01', 'A', 'Студия звукозаписи "Нижняя"', id, 1 from inventory.rooms where code = 'A-01-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-01-02-02', 'A', 'Вокальная кабина студии "Нижняя"', id, 2 from inventory.rooms where code = 'A-01-02';

-- 1-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-01', 'A', 'Коридор', id, 1 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-02', 'A', 'Комната хранения 1', id, 2 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-03', 'A', 'Туалет 1', id, 3 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-04', 'A', 'Студия "Digital" (Кухня)', id, 4 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-05', 'A', 'Аппаратная ТВ', id, 5 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-06', 'A', 'Кабинет общего назначения "Морской"', id, 6 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-07', 'A', 'Туалет 2', id, 7 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-08', 'A', 'Кабинет технического отдела департамента Радио', id, 8 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09', 'A', 'Аппаратная Радио', id, 9 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-10', 'A', 'Радиоредакция', id, 10 from inventory.rooms where code = 'A-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-11', 'A', 'Кабинет Бренд Медиа', id, 11 from inventory.rooms where code = 'A-02';

-- A-02-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-01-01', 'A', 'Коридор', id, 1 from inventory.rooms where code = 'A-02-01';

-- A-02-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-02-01', 'A', 'Комната хранения 1', id, 1 from inventory.rooms where code = 'A-02-02';

-- A-02-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-03-01', 'A', 'Туалет 1', id, 1 from inventory.rooms where code = 'A-02-03';

-- A-02-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-04-01', 'A', 'Студия "Digital" (Кухня)', id, 1 from inventory.rooms where code = 'A-02-04';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-04-02', 'A', 'Комната хранения 2 (на пожарном выходе)', id, 2 from inventory.rooms where code = 'A-02-04';

-- A-02-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-05-01', 'A', 'Аппаратная ТВ', id, 1 from inventory.rooms where code = 'A-02-05';

-- A-02-06 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-06-01', 'A', 'Кабинет общего назначения "Морской"', id, 1 from inventory.rooms where code = 'A-02-06';

-- A-02-07 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-07-01', 'A', 'Туалет 2', id, 1 from inventory.rooms where code = 'A-02-07';

-- A-02-08 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-08-01', 'A', 'Кабинет технического отдела департамента Радио', id, 1 from inventory.rooms where code = 'A-02-08';

-- A-02-09 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09-01', 'A', 'Аппаратная Радио', id, 1 from inventory.rooms where code = 'A-02-09';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09-02', 'A', 'Радиостудия', id, 2 from inventory.rooms where code = 'A-02-09';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-09-03', 'A', 'Кабина звукозаписи', id, 3 from inventory.rooms where code = 'A-02-09';

-- A-02-10 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-10-01', 'A', 'Радиоредакция', id, 1 from inventory.rooms where code = 'A-02-10';

-- A-02-11 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'A-02-11-01', 'A', 'Кабинет Бренд Медиа', id, 1 from inventory.rooms where code = 'A-02-11';

-- ============================================================
-- Предзаполнение: Офис B — Знаменка-25
-- ============================================================

-- Этажи
insert into inventory.rooms (code, office, name, parent_id, sort_order) values
  ('B-01', 'B', '1-й Этаж', null, 1),
  ('B-02', 'B', '2-й Этаж', null, 2),
  ('B-03', 'B', '3-й Этаж', null, 3);

-- 1-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-01', 'B', 'Хол 1-го этажа', id, 1 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-02', 'B', 'Студия "Открытый микрофон"', id, 2 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-03', 'B', 'Склад', id, 3 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-04', 'B', 'Туалет 1', id, 4 from inventory.rooms where code = 'B-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-05', 'B', 'Студия "Каминный зал"', id, 5 from inventory.rooms where code = 'B-01';

-- B-01-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-01-01', 'B', 'Хол 1-го этажа', id, 1 from inventory.rooms where code = 'B-01-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-01-02', 'B', 'Подсобное помещение 1', id, 2 from inventory.rooms where code = 'B-01-01';

-- B-01-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-02-01', 'B', 'Студия "Открытый микрофон"', id, 1 from inventory.rooms where code = 'B-01-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-02-02', 'B', 'Кухня', id, 2 from inventory.rooms where code = 'B-01-02';

-- B-01-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-03-01', 'B', 'Склад', id, 1 from inventory.rooms where code = 'B-01-03';

-- B-01-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-04-01', 'B', 'Туалет 1', id, 1 from inventory.rooms where code = 'B-01-04';

-- B-01-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-05-01', 'B', 'Студия "Каминный зал"', id, 1 from inventory.rooms where code = 'B-01-05';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-01-05-02', 'B', 'Аппаратная ТВ (Офис эфирной бригады)', id, 2 from inventory.rooms where code = 'B-01-05';

-- 2-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-01', 'B', 'Хол 2-го этажа', id, 1 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02', 'B', 'Кабинет отдела Постпродакшена', id, 2 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-03', 'B', 'Туалет 3', id, 3 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-04', 'B', 'Кабинет CEO', id, 4 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-05', 'B', 'Кабинет отдела Дизайна', id, 5 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-06', 'B', 'Кабинет Продюсеров', id, 6 from inventory.rooms where code = 'B-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07', 'B', 'Помещение перед лестницей на 3-й этаж', id, 7 from inventory.rooms where code = 'B-02';

-- B-02-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-01-01', 'B', 'Хол 2-го этажа', id, 1 from inventory.rooms where code = 'B-02-01';

-- B-02-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02-01', 'B', 'Кабинет отдела Постпродакшена', id, 1 from inventory.rooms where code = 'B-02-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02-02', 'B', 'Туалет 2 (Будущая студия звукозаписи)', id, 2 from inventory.rooms where code = 'B-02-02';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-02-03', 'B', 'Подсобное помещение 2', id, 3 from inventory.rooms where code = 'B-02-02';

-- B-02-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-03-01', 'B', 'Туалет 3', id, 1 from inventory.rooms where code = 'B-02-03';

-- B-02-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-04-01', 'B', 'Кабинет CEO', id, 1 from inventory.rooms where code = 'B-02-04';

-- B-02-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-05-01', 'B', 'Кабинет отдела Дизайна', id, 1 from inventory.rooms where code = 'B-02-05';

-- B-02-06 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-06-01', 'B', 'Кабинет Продюсеров', id, 1 from inventory.rooms where code = 'B-02-06';

-- B-02-07 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07-01', 'B', 'Помещение перед лестницей на 3-й этаж', id, 1 from inventory.rooms where code = 'B-02-07';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07-02', 'B', 'Подсобное помещение отдела АХО', id, 2 from inventory.rooms where code = 'B-02-07';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-02-07-03', 'B', 'Подсобное помещение на лестничном пролёте (2-й и 3-й этаж)', id, 3 from inventory.rooms where code = 'B-02-07';

-- 3-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01', 'B', 'Студия "Медиа Крыша"', id, 1 from inventory.rooms where code = 'B-03';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-02', 'B', 'Чердак', id, 2 from inventory.rooms where code = 'B-03';

-- B-03-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01-01', 'B', 'Студия "Медиа Крыша"', id, 1 from inventory.rooms where code = 'B-03-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01-02', 'B', 'Мансарда левое крыло', id, 2 from inventory.rooms where code = 'B-03-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-01-03', 'B', 'Мансарда правое крыло', id, 3 from inventory.rooms where code = 'B-03-01';

-- B-03-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'B-03-02-01', 'B', 'Чердак (Доступ к кондиционеру)', id, 1 from inventory.rooms where code = 'B-03-02';

-- ============================================================
-- Предзаполнение: Офис C — Знаменка-13
-- ============================================================

-- Этажи
insert into inventory.rooms (code, office, name, parent_id, sort_order) values
  ('C-01', 'C', '1-й Этаж', null, 1);

-- 1-й Этаж → Помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-01', 'C', 'Хол', id, 1 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-02', 'C', 'Склад 1', id, 2 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-03', 'C', 'Склад 2 / Кабинет руководителей отделов ТВ Тех. и АХО', id, 3 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-04', 'C', 'Кухня', id, 4 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-05', 'C', 'Коридор', id, 5 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-06', 'C', 'Туалет', id, 6 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-07', 'C', 'Кабинет Фин. отдела и документооборота', id, 7 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-08', 'C', 'Кабинет HR и руководителя отдела Спецпроектов', id, 8 from inventory.rooms where code = 'C-01';
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-09', 'C', 'Кабинет отдела спецпроектов (Отдел продаж)', id, 9 from inventory.rooms where code = 'C-01';

-- C-01-01 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-01-01', 'C', 'Хол', id, 1 from inventory.rooms where code = 'C-01-01';

-- C-01-02 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-02-01', 'C', 'Склад 1', id, 1 from inventory.rooms where code = 'C-01-02';

-- C-01-03 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-03-01', 'C', 'Склад 2 / Кабинет руководителей отделов ТВ Тех. и АХО', id, 1 from inventory.rooms where code = 'C-01-03';

-- C-01-04 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-04-01', 'C', 'Кухня', id, 1 from inventory.rooms where code = 'C-01-04';

-- C-01-05 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-05-01', 'C', 'Коридор', id, 1 from inventory.rooms where code = 'C-01-05';

-- C-01-06 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-06-01', 'C', 'Туалет', id, 1 from inventory.rooms where code = 'C-01-06';

-- C-01-07 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-07-01', 'C', 'Кабинет Фин. отдела и документооборота', id, 1 from inventory.rooms where code = 'C-01-07';

-- C-01-08 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-08-01', 'C', 'Кабинет HR и руководителя отдела Спецпроектов', id, 1 from inventory.rooms where code = 'C-01-08';

-- C-01-09 → Под-помещения
insert into inventory.rooms (code, office, name, parent_id, sort_order)
select 'C-01-09-01', 'C', 'Кабинет отдела спецпроектов (Отдел продаж)', id, 1 from inventory.rooms where code = 'C-01-09';
