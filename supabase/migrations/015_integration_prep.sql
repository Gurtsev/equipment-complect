-- Подготовка к интеграции с Nexus (КСУ)
-- Соглашение об именовании: ссылки на пользователя = user_id
ALTER TABLE employee_assignments RENAME COLUMN profile_id TO user_id;

-- Добавить is_active для совместимости с shared.users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
