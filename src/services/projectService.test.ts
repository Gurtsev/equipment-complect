import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted позволяет использовать переменную внутри vi.mock до её объявления
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
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
    mockRpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'not found' } });
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

describe('projectService — atomic project RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт проект и состав одним RPC без legacy-запросов', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const project = makeProject(['eq1', 'eq1', 'eq2']);

    await projectService.add(project);

    expect(mockRpc).toHaveBeenCalledWith('create_project_with_equipment', {
      p_project_id: 'PRJ-001',
      p_name: 'Test',
      p_client: '',
      p_start_date: '2024-01-01T00:00:00.000Z',
      p_end_date: '2024-01-31T00:00:00.000Z',
      p_location: 'Романов',
      p_responsible: 'Ivan',
      p_status: 'Планируется',
      p_notes: '',
      p_equipment_ids: ['eq1', 'eq2'],
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('обновляет метаданные и состав одним RPC', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const project = makeProject(['eq1', 'eq2']);

    await projectService.update(project);

    expect(mockRpc).toHaveBeenCalledWith(
      'update_project_with_equipment',
      expect.objectContaining({
        p_project_id: 'PRJ-001',
        p_equipment_ids: ['eq1', 'eq2'],
      }),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('не скрывает серверный конфликт проекта через legacy fallback', async () => {
    const error = { code: 'P0001', message: 'INVENTORY_PROJECT_PERIOD_CONFLICT' };
    mockRpc.mockResolvedValue({ error });

    await expect(projectService.update(makeProject(['eq1']))).rejects.toBe(error);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('атомарно добавляет оборудование и возвращает число закрытых займов', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });

    await expect(projectService.addEquipmentAtomic('PRJ-001', ['eq1', 'eq1', 'eq2'], {
      listId: 'list-1',
      listName: 'Камеры',
      skippedCount: 3,
    })).resolves.toBe(2);

    expect(mockRpc).toHaveBeenCalledWith('add_project_equipment', {
      p_project_id: 'PRJ-001',
      p_equipment_ids: ['eq1', 'eq2'],
      p_list_id: 'list-1',
      p_list_name: 'Камеры',
      p_skipped_count: 3,
    });
  });

  it('сигнализирует UI использовать fallback, если RPC 030 отсутствует', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'not found' } });

    await expect(projectService.removeEquipmentAtomic('PRJ-001', ['eq1']))
      .resolves.toBe(false);
  });

  it('переводит статус проекта одной серверной операцией', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await expect(projectService.transitionAtomic('PRJ-001', 'Активен')).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('transition_project', {
      p_project_id: 'PRJ-001',
      p_target_status: 'Активен',
    });
  });
});
