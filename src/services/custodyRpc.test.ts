import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { assignmentService } from './assignmentService';
import { loanService } from './loanService';

describe('custody RPC operations', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('assigns equipment through one RPC without legacy writes', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await assignmentService.assign('eq-1', 'user-1', 'Иван', 'Офис', 'Камера');

    expect(rpcMock).toHaveBeenCalledWith('assign_equipment', {
      p_equipment_id: 'eq-1',
      p_user_id: 'user-1',
      p_current_location: 'Офис',
      p_notes: 'Камера',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('uses the legacy assignment path only when migration 029 is unavailable', async () => {
    rpcMock.mockResolvedValue({ error: { code: 'PGRST202', message: 'not found' } });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'employee_assignments' || table === 'equipment_history') {
        return { insert: insertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await assignmentService.assign('eq-1', 'user-1', 'Иван', 'Офис');

    expect(fromMock).toHaveBeenNthCalledWith(1, 'employee_assignments');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'equipment_history');
  });

  it('does not hide an application error behind the legacy path', async () => {
    const error = { code: 'P0001', message: 'INVENTORY_ACTIVE_ASSIGNMENT_EXISTS' };
    rpcMock.mockResolvedValue({ error });

    await expect(assignmentService.assign('eq-1', 'user-1', 'Иван', 'Офис'))
      .rejects.toBe(error);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('creates an equipment loan through the atomic RPC', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await loanService.create({
      equipmentId: 'eq-1',
      loanType: 'employee',
      toProfileId: 'user-1',
      currentLocation: 'Офис',
      startDate: '2026-08-18T09:00:00.000Z',
      dueDate: '2026-08-20T09:00:00.000Z',
      notes: 'Смена',
    });

    expect(rpcMock).toHaveBeenCalledWith('create_equipment_loan', {
      p_equipment_id: 'eq-1',
      p_to_profile_id: 'user-1',
      p_current_location: 'Офис',
      p_start_date: '2026-08-18T09:00:00.000Z',
      p_project_id: null,
      p_due_date: '2026-08-20T09:00:00.000Z',
      p_notes: 'Смена',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
