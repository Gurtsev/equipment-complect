import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted позволяет использовать переменную внутри vi.mock до её объявления
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom },
}));

import { projectService } from './projectService';
import { Project } from '../models/Project';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeProject(equipmentIds: string[]) {
  return new Project({
    id: 'PRJ-001',
    name: 'Test',
    client: '',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    location: 'Романов',
    responsible: 'Ivan',
    status: 'Планируется',
    equipmentIds,
    notes: '',
  });
}

/** Настраивает mockFrom для projectService.update.
 *  Порядок вызовов from() внутри update:
 *  1. projects → UPDATE
 *  2. project_equipment → SELECT (текущие ids)
 *  3. project_equipment → DELETE (если есть что удалить)
 *  4. project_equipment → INSERT (если есть что добавить)
 */
function setupUpdateMocks(currentIds: string[]) {
  const deleteInSpy = vi.fn().mockResolvedValue({ error: null });
  const insertSpy = vi.fn().mockResolvedValue({ error: null });

  mockFrom
    .mockReturnValueOnce({
      // 1. projects UPDATE
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })
    .mockReturnValueOnce({
      // 2. project_equipment SELECT
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: currentIds.map((id) => ({ equipment_id: id })),
          error: null,
        }),
      }),
    })
    .mockReturnValue({
      // 3 и 4. DELETE и/или INSERT (порядок зависит от логики)
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ in: deleteInSpy }),
      }),
      insert: insertSpy,
    });

  return { deleteInSpy, insertSpy };
}

// ── Тесты ──────────────────────────────────────────────────────────────────

describe('projectService.update — diff-синхронизация оборудования', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('удаляет только убранные id, не трогает оставшиеся', async () => {
    const { deleteInSpy, insertSpy } = setupUpdateMocks(['eq1', 'eq2', 'eq3']);

    await projectService.update(makeProject(['eq1', 'eq2'])); // eq3 убран

    expect(deleteInSpy).toHaveBeenCalledOnce();
    expect(deleteInSpy).toHaveBeenCalledWith('equipment_id', ['eq3']);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('вставляет только новые id, не дублирует существующие', async () => {
    const { deleteInSpy, insertSpy } = setupUpdateMocks(['eq1', 'eq2']);

    await projectService.update(makeProject(['eq1', 'eq2', 'eq3'])); // eq3 добавлен

    expect(insertSpy).toHaveBeenCalledOnce();
    expect(insertSpy).toHaveBeenCalledWith([
      { project_id: 'PRJ-001', equipment_id: 'eq3' },
    ]);
    expect(deleteInSpy).not.toHaveBeenCalled();
  });

  it('не вызывает delete если ничего не убрано', async () => {
    const { deleteInSpy } = setupUpdateMocks(['eq1', 'eq2']);

    await projectService.update(makeProject(['eq1', 'eq2'])); // без изменений

    expect(deleteInSpy).not.toHaveBeenCalled();
  });

  it('не вызывает insert если ничего не добавлено', async () => {
    const { insertSpy } = setupUpdateMocks(['eq1', 'eq2', 'eq3']);

    await projectService.update(makeProject(['eq1', 'eq2'])); // eq3 убран, ничего не добавлено

    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('обрабатывает полную замену комплекта', async () => {
    const { deleteInSpy, insertSpy } = setupUpdateMocks(['eq1', 'eq2']);

    await projectService.update(makeProject(['eq3', 'eq4'])); // eq1,eq2 убраны, eq3,eq4 добавлены

    expect(deleteInSpy).toHaveBeenCalledWith('equipment_id', expect.arrayContaining(['eq1', 'eq2']));
    expect(insertSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        { project_id: 'PRJ-001', equipment_id: 'eq3' },
        { project_id: 'PRJ-001', equipment_id: 'eq4' },
      ]),
    );
  });
});
