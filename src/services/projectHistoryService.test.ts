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

describe('projectHistoryService compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('не отправляет колонки миграции 024 для обычного действия', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });

    await projectHistoryService.addEntry('PRJ-1', 'updated');

    expect(insert).toHaveBeenCalledWith({
      project_id: 'PRJ-1',
      action: 'updated',
      equipment_id: null,
      equipment_name: null,
    });
  });

  it('использует старый набор колонок, если миграция 024 ещё не применена', async () => {
    const row = {
      id: 'history-1',
      project_id: 'PRJ-1',
      user_id: null,
      action: 'updated',
      equipment_id: null,
      equipment_name: null,
      recorded_at: '2026-08-17T10:00:00Z',
    };
    mockFrom
      .mockReturnValueOnce(historyQuery({ data: null, error: { code: '42703' } }))
      .mockReturnValueOnce(historyQuery({ data: [row], error: null }));

    const result = await projectHistoryService.getForProject('PRJ-1');

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result[0]).toMatchObject({ id: 'history-1', action: 'updated' });
  });
});

