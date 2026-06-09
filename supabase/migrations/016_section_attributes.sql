-- Раздел каталога: tech (Техника), furniture (Мебель), prop (Реквизит)
ALTER TABLE inventory.equipment
  ADD COLUMN section text NOT NULL DEFAULT 'tech'
    CHECK (section IN ('tech', 'furniture', 'prop'));

-- Авто-заполнение section для существующих записей по category
UPDATE inventory.equipment SET section = 'furniture' WHERE category = 'furniture';
UPDATE inventory.equipment SET section = 'prop'      WHERE category = 'prop';

-- Гибкие атрибуты: { "Цвет": "Красный", "Высота": "75 см", ... }
ALTER TABLE inventory.equipment
  ADD COLUMN attributes jsonb;

-- Количество для реквизита (шарики, одежда и т.д.)
ALTER TABLE inventory.equipment
  ADD COLUMN quantity integer;
