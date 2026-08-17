import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const supabaseDir = path.dirname(migrationsDir);
const migrationPattern = /^\d{3}_.+\.sql$/;
const combinedPattern = /^combined_\d{3}_\d{3}\.sql$/;
const checkOnly = process.argv.includes('--check');

const files = (await readdir(migrationsDir))
  .filter((file) => migrationPattern.test(file))
  .sort((left, right) => left.localeCompare(right));

if (files.length === 0) {
  throw new Error('Миграции supabase/migrations/*.sql не найдены');
}

const first = files[0].slice(0, 3);
const last = files.at(-1).slice(0, 3);
const targetName = `combined_${first}_${last}.sql`;
const targetPath = path.join(supabaseDir, targetName);
const separator = '-- ─────────────────────────────────────────────────────────────';

const sections = await Promise.all(files.map(async (file) => {
  const sql = (await readFile(path.join(migrationsDir, file), 'utf8')).trim();
  return `${separator}\n-- Миграция: ${file}\n${separator}\n${sql}`;
}));

const output = [
  '-- ============================================================',
  `-- Объединённые миграции ${first}-${last} для применения на чистой self-hosted БД одним скриптом`,
  '-- Сгенерировано командой npm run db:combine; вручную не редактировать',
  '-- ============================================================',
  '',
  ...sections.flatMap((section) => [section, '']),
].join('\n');

const combinedFiles = (await readdir(supabaseDir)).filter((file) => combinedPattern.test(file));

if (checkOnly) {
  if (combinedFiles.length !== 1 || combinedFiles[0] !== targetName) {
    console.error(`Ожидается только supabase/${targetName}; выполните npm run db:combine`);
    process.exitCode = 1;
  } else {
    const current = await readFile(targetPath, 'utf8');
    if (current !== output) {
      console.error(`supabase/${targetName} устарел; выполните npm run db:combine`);
      process.exitCode = 1;
    }
  }
} else {
  await Promise.all(
    combinedFiles
      .filter((file) => file !== targetName)
      .map((file) => unlink(path.join(supabaseDir, file))),
  );
  await writeFile(targetPath, output, 'utf8');
  console.log(`Сформирован supabase/${targetName} из ${files.length} миграций`);
}

