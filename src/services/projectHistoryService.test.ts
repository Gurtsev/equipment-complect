import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import { projectHistoryService } from './projectHistoryService';

function historyQuery(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

describe('projectHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('не скрывает ошибку production-контракта миграции 024', async () => {
    const error = { code: '42703', message: 'column list_id does not exist' };
    mockFrom.mockReturnValueOnce(historyQuery({ data: null, error }));

    await expect(projectHistoryService.getForProject('PRJ-1')).rejects.toBe(error);
    expect(mockFrom).toHaveBeenCalledOnce();
  });

  it('читает расширенную историю импорта списка', async () => {
    mockFrom.mockReturnValueOnce(historyQuery({
      data: [{
        id: 'history-1',
        project_id: 'PRJ-1',
        user_id: null,
        action: 'list_imported',
        equipment_id: null,
        equipment_name: null,
        list_id: 'list-1',
        list_name: 'Камеры',
        imported_count: 3,
        skipped_count: 1,
        recorded_at: '2026-08-18T10:00:00Z',
      }],
      error: null,
    }));

    const result = await projectHistoryService.getForProject('PRJ-1');

    expect(result[0]).toMatchObject({
      action: 'list_imported',
      listId: 'list-1',
      listName: 'Камеры',
      importedCount: 3,
      skippedCount: 1,
    });
  });
});
