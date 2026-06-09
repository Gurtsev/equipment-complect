import { supabase } from './supabase';
import { historyService } from './historyService';
import { EquipmentLocation } from '../models/Equipment';

export interface Assignment {
  id: string;
  equipmentId: string;
  profileId: string;
  profileName: string;
  assignedAt: Date;
  returnedAt: Date | null;
  notes?: string;
}

export interface ProfileAssignment {
  id: string;
  equipmentId: string;
  equipmentModel: string;
  equipmentInvNumber: string;
  equipmentImage: string;
  assignedAt: Date;
  returnedAt: Date | null;
  notes?: string;
}

export const assignmentService = {
  async getCurrentAssignment(equipmentId: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('employee_assignments')
      .select('*')
      .eq('equipment_id', equipmentId)
      .is('returned_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: profiles } = await supabase.rpc('get_profile_names', { ids: [data.user_id] });
    return {
      id: data.id,
      equipmentId: data.equipment_id,
      profileId: data.user_id,
      profileName: profiles?.[0]?.name ?? '—',
      assignedAt: new Date(data.assigned_at),
      returnedAt: data.returned_at ? new Date(data.returned_at) : null,
      notes: data.notes ?? undefined,
    };
  },

  async getForProfile(profileId: string): Promise<ProfileAssignment[]> {
    const { data, error } = await supabase
      .from('employee_assignments')
      .select('*, equipment!equipment_id(id, model, inv_number, image)')
      .eq('user_id', profileId)
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => {
      const eq = r.equipment as { id: string; model: string; inv_number: string; image: string } | null;
      return {
        id: r.id,
        equipmentId: r.equipment_id,
        equipmentModel: eq?.model ?? r.equipment_id,
        equipmentInvNumber: eq?.inv_number ?? '—',
        equipmentImage: eq?.image ?? '',
        assignedAt: new Date(r.assigned_at),
        returnedAt: r.returned_at ? new Date(r.returned_at) : null,
        notes: r.notes ?? undefined,
      };
    });
  },

  async assign(
    equipmentId: string,
    profileId: string,
    profileName: string,
    currentLocation: EquipmentLocation,
    notes?: string,
  ): Promise<void> {
    const { error } = await supabase.from('employee_assignments').insert({
      equipment_id: equipmentId,
      user_id: profileId,
      notes: notes ?? null,
    });
    if (error) throw error;
    await historyService.addEntry(equipmentId, 'Выдан', currentLocation, profileName);
  },

  async returnEquipment(assignmentId: string, equipmentId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_assignments')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', assignmentId);
    if (error) throw error;
    await historyService.addEntry(equipmentId, 'На Складе', 'Склад', '');
  },
};
