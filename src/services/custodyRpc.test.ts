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

    await assignmentService.assign('eq-1', 'user-1', 'Офис', 'Камера');

    expect(rpcMock).toHaveBeenCalledWith('assign_equipment', {
      p_equipment_id: 'eq-1',
      p_user_id: 'user-1',
      p_current_location: 'Офис',
      p_notes: 'Камера',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('fails closed without legacy writes when migration 029 RPC is unavailable', async () => {
    const error = { code: 'PGRST202', message: 'not found' };
    rpcMock.mockResolvedValue({ error });

    await expect(assignmentService.assign('eq-1', 'user-1', 'Офис'))
      .rejects.toBe(error);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('propagates an application error without extra writes', async () => {
    const error = { code: 'P0001', message: 'INVENTORY_ACTIVE_ASSIGNMENT_EXISTS' };
    rpcMock.mockResolvedValue({ error });

    await expect(assignmentService.assign('eq-1', 'user-1', 'Офис'))
      .rejects.toBe(error);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an assignment through one RPC without legacy writes', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await assignmentService.returnEquipment('assignment-1');

    expect(rpcMock).toHaveBeenCalledWith('return_equipment_assignment', {
      p_assignment_id: 'assignment-1',
    });
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

  it('returns an equipment loan through one RPC without legacy writes', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await loanService.returnLoan('loan-1');

    expect(rpcMock).toHaveBeenCalledWith('return_equipment_loan', {
      p_loan_id: 'loan-1',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('fails closed without legacy loan writes when migration 029 RPC is unavailable', async () => {
    const error = { code: 'PGRST202', message: 'not found' };
    rpcMock.mockResolvedValue({ error });

    await expect(loanService.returnLoan('loan-1')).rejects.toBe(error);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
