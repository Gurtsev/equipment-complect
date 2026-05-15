import { supabase } from './supabase';
import { Equipment, EquipmentCategory, EquipmentLocation, EquipmentStatus } from '../models/Equipment';

interface EquipmentRow {
  id: string;
  model: string;
  subtitle: string;
  category: string;
  description: string;
  image: string;
  inv_number: string;
  serial_number: string;
  responsible: string;
  accessories: string[];
}

interface HistoryRow {
  equipment_id: string;
  status: string;
  location: string;
  responsible: string;
  recorded_at: string;
}

function toEquipment(row: EquipmentRow, history: HistoryRow[]): Equipment {
  return new Equipment({
    id: row.id,
    model: row.model,
    subtitle: row.subtitle,
    category: row.category as EquipmentCategory,
    description: row.description,
    image: row.image,
    invNumber: row.inv_number,
    serialNumber: row.serial_number,
    responsible: row.responsible,
    accessories: row.accessories ?? [],
    history: history.map((h) => ({
      date: new Date(h.recorded_at),
      status: h.status as EquipmentStatus,
      location: h.location as EquipmentLocation,
      responsible: h.responsible,
    })),
  });
}

export const equipmentService = {
  async getAll(): Promise<Equipment[]> {
    console.log('[equipmentService] getAll start');
    const { data: rows, error: eqErr } = await supabase
      .from('equipment')
      .select('*')
      .order('created_at', { ascending: false });
    console.log('[equipmentService] getAll result', { rows, eqErr });
    if (eqErr) throw eqErr;
    if (!rows || rows.length === 0) return [];

    const { data: histRows, error: hErr } = await supabase
      .from('equipment_history')
      .select('*')
      .in('equipment_id', rows.map((r) => r.id))
      .order('recorded_at', { ascending: false });
    if (hErr) throw hErr;

    const byId = new Map<string, HistoryRow[]>();
    for (const h of histRows ?? []) {
      const arr = byId.get(h.equipment_id) ?? [];
      arr.push(h);
      byId.set(h.equipment_id, arr);
    }

    return rows.map((r) => toEquipment(r, byId.get(r.id) ?? []));
  },

  async add(equipment: Equipment): Promise<void> {
    const { error: eqErr } = await supabase.from('equipment').insert({
      id: equipment.id,
      model: equipment.model,
      subtitle: equipment.subtitle,
      category: equipment.category,
      description: equipment.description,
      image: equipment.image,
      inv_number: equipment.invNumber,
      serial_number: equipment.serialNumber,
      responsible: equipment.responsible,
      accessories: equipment.accessories,
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
        description: equipment.description,
        image: equipment.image,
        serial_number: equipment.serialNumber,
        responsible: equipment.responsible,
        accessories: equipment.accessories,
      })
      .eq('id', equipment.id);
    if (error) throw error;
  },
};
