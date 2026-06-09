alter table inventory.rooms
  add column if not exists responsible text not null default '';
