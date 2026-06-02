-- Раздел каталога: tech (Техника), furniture (Мебель), prop (Реквизит)
ALTER TABLE equipment
  ADD COLUMN section text NOT NULL DEFAULT 'tech'
    CHECK (section IN ('tech', 'furniture', 'prop'));

-- Авто-заполнение section для существующих записей по category
UPDATE equipment SET section = 'furniture' WHERE category = 'furniture';
UPDATE equipment SET section = 'prop'      WHERE category = 'prop';

-- Гибкие атрибуты: { "Цвет": "Красный", "Высота": "75 см", ... }
ALTER TABLE equipment
  ADD COLUMN attributes jsonb;

-- Количество для реквизита (шарики, одежда и т.д.)
ALTER TABLE equipment
  ADD COLUMN quantity integer;
