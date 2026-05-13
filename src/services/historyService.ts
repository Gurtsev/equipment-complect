import { supabase } from './supabase';
import { EquipmentStatus, EquipmentLocation } from '../models/Equipment';

export const historyService = {
  async addEntry(
    equipmentId: string,
    status: EquipmentStatus,
    location: EquipmentLocation,
    responsible: string,
  ): Promise<void> {
    const { error } = await supabase.from('equipment_history').insert({
      equipment_id: equipmentId,
      status,
      location,
      responsible,
    });
    if (error) throw error;
  },
};
