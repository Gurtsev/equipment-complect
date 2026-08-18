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

// ── Тесты ──────────────────────────────────────────────────────────────────

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

  it('не скрывает серверный конфликт проекта', async () => {
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

  it('не обходит атомарный контракт, если RPC 030 отсутствует', async () => {
    const error = { code: 'PGRST202', message: 'not found' };
    mockRpc.mockResolvedValue({ error });

    await expect(projectService.removeEquipmentAtomic('PRJ-001', ['eq1']))
      .rejects.toBe(error);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('переводит статус проекта одной серверной операцией', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await expect(projectService.transitionAtomic('PRJ-001', 'Активен')).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('transition_project', {
      p_project_id: 'PRJ-001',
      p_target_status: 'Активен',
    });
  });
});
