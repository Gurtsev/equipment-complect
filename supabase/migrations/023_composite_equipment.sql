-- Составные объекты учёта (ПК и комплекты, этап 4.12):
-- equipment может входить в состав другого equipment (parent_id),
-- родитель отслеживает статус сборки для сверки с 1С.

alter table inventory.equipment
  add column parent_id text references inventory.equipment(id) on delete set null;

alter table inventory.equipment
  add column assembly_status text check (assembly_status in ('assembling', 'ready', 'synced'));

create index equipment_parent_id_idx on inventory.equipment(parent_id);
