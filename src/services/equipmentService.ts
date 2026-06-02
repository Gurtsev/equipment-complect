import { supabase } from './supabase';
import { Equipment, EquipmentCategory, EquipmentDepartment, EquipmentLocation, EquipmentSection, EquipmentStatus } from '../models/Equipment';

interface EquipmentRow {
  id: string;
  model: string;
  subtitle: string;
  category: string;
  department: string;
  section: string;
  description: string;
  image: string;
  inv_number: string;
  serial_number: string;
  responsible: string;
  accessories: string[];
  room_id: string | null;
  attributes: Record<string, string> | null;
  quantity: number | null;
}

interface HistoryRow {
  equipment_id: string;
  status: string;
  location: string;
  responsible: string;
  recorded_at: string;
  user_id: string | null;
}

function toEquipment(row: EquipmentRow, history: HistoryRow[], nameById: Map<string, string>): Equipment {
  return new Equipment({
    id: row.id,
    model: row.model,
    subtitle: row.subtitle,
    category: row.category as EquipmentCategory,
    department: (row.department ?? 'studio') as EquipmentDepartment,
    section: (row.section ?? 'tech') as EquipmentSection,
    description: row.description,
    image: row.image,
    invNumber: row.inv_number,
    serialNumber: row.serial_number,
    responsible: row.responsible,
    accessories: row.accessories ?? [],
    roomId: row.room_id ?? null,
    attributes: row.attributes ?? null,
    quantity: row.quantity ?? null,
    history: history.map((h) => ({
      date: new Date(h.recorded_at),
      status: h.status as EquipmentStatus,
      location: h.location as EquipmentLocation,
      responsible: h.responsible,
      userName: h.user_id ? nameById.get(h.user_id) : undefined,
    })),
  });
}

export const equipmentService = {
  async getAll(): Promise<Equipment[]> {
    const { data: rows, error: eqErr } = await supabase
      .from('equipment')
      .select('*')
      .order('created_at', { ascending: false });
    if (eqErr) throw eqErr;
    if (!rows || rows.length === 0) return [];

    const { data: histRows, error: hErr } = await supabase
      .from('equipment_history')
      .select('equipment_id, status, location, responsible, recorded_at, user_id')
      .in('equipment_id', rows.map((r) => r.id))
      .order('recorded_at', { ascending: false });
    if (hErr) throw hErr;

    const byEquipment = new Map<string, HistoryRow[]>();
    for (const h of histRows ?? []) {
      const arr = byEquipment.get(h.equipment_id) ?? [];
      arr.push(h);
      byEquipment.set(h.equipment_id, arr);
    }

    const userIds = [...new Set((histRows ?? []).map((h) => h.user_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      for (const p of profiles ?? []) nameById.set(p.id, p.name);
    }

    return rows.map((r) => toEquipment(r, byEquipment.get(r.id) ?? [], nameById));
  },

  async add(equipment: Equipment): Promise<void> {
    const { error: eqErr } = await supabase.from('equipment').insert({
      id: equipment.id,
      model: equipment.model,
      subtitle: equipment.subtitle,
      category: equipment.category,
      department: equipment.department,
      section: equipment.section,
      description: equipment.description,
      image: equipment.image,
      inv_number: equipment.invNumber,
      serial_number: equipment.serialNumber,
      responsible: equipment.responsible,
      accessories: equipment.accessories,
      room_id: equipment.roomId ?? null,
      attributes: equipment.attributes ?? null,
      quantity: equipment.quantity ?? null,
    });
    if (eqErr) throw eqErr;

    if (equipment.history.length > 0) {
      const h = equipment.history[0];
      const { error: hErr } = await supabase.from('equipment_history').insert({
        equipment_id: equipment.id,
        status: h.status,
        location: h.location,
        responsible: h.responsible,
        recorded_at: h.date.toISOString(),
      });
      if (hErr) throw hErr;
    }
  },

  async update(equipment: Equipment): Promise<void> {
    const { error } = await supabase
      .from('equipment')
      .update({
        model: equipment.model,
        subtitle: equipment.subtitle,
        category: equipment.category,
        department: equipment.department,
        section: equipment.section,
        description: equipment.description,
        image: equipment.image,
        serial_number: equipment.serialNumber,
        responsible: equipment.responsible,
        accessories: equipment.accessories,
        room_id: equipment.roomId ?? null,
        attributes: equipment.attributes ?? null,
        quantity: equipment.quantity ?? null,
      })
      .eq('id', equipment.id);
    if (error) throw error;
  },
};
