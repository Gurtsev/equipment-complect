import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import { Equipment } from '../models/Equipment';
import { equipmentService } from './equipmentService';

function makeEquipment() {
  return new Equipment({
    id: 'EQ-031',
    model: 'Atomic camera',
    subtitle: 'Test',
    category: 'camera',
    section: 'tech',
    description: 'Created by RPC',
    image: '/camera.jpg',
    invNumber: '',
    serialNumber: 'SN-031',
    responsible: 'Иван',
    accessories: ['Battery'],
    roomId: '00000000-0000-0000-0000-000000000031',
    attributes: { Color: 'Black' },
    quantity: 1,
    parentId: null,
    assemblyStatus: null,
    history: [{
      date: new Date('2026-08-19T08:00:00.000Z'),
      status: 'На Складе',
      location: 'Склад',
      responsible: 'Иван',
    }],
  });
}

describe('equipmentService — atomic equipment creation RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт карточку и начальную историю одним RPC', async () => {
    mockRpc.mockResolvedValue({ data: 'EQ-031', error: null });

    await expect(equipmentService.add(makeEquipment())).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenCalledWith('create_equipment_with_history', {
      p_id: 'EQ-031',
      p_model: 'Atomic camera',
      p_subtitle: 'Test',
      p_category: 'camera',
      p_section: 'tech',
      p_description: 'Created by RPC',
      p_image: '/camera.jpg',
      p_inv_number: '',
      p_serial_number: 'SN-031',
      p_responsible: 'Иван',
      p_accessories: ['Battery'],
      p_room_id: '00000000-0000-0000-0000-000000000031',
      p_attributes: { Color: 'Black' },
      p_quantity: 1,
      p_parent_id: null,
      p_assembly_status: null,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('не возвращается к неатомарным insert при ошибке RPC', async () => {
    const error = { code: 'PGRST202', message: 'RPC not found' };
    mockRpc.mockResolvedValue({ data: null, error });

    await expect(equipmentService.add(makeEquipment())).rejects.toBe(error);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
