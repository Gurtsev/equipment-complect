import { supabase } from './supabase';

export type ConsumableCategory = 'hygiene' | 'drinks' | 'stationery' | 'cleaning' | 'other';

export interface Consumable {
  id: string;
  name: string;
  category: ConsumableCategory;
  unit: string;
  quantity: number;
  minThreshold: number;
  notes: string | null;
  createdAt: Date;
}

export interface ConsumableTransaction {
  id: string;
  consumableId: string;
  type: 'in' | 'out' | 'writeoff';
  delta: number;
  userName: string | null;
  recordedAt: Date;
  notes: string | null;
}

export const consumablesService = {
  async getAll(): Promise<Consumable[]> {
    const { data, error } = await supabase
      .from('consumables')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as ConsumableCategory,
      unit: row.unit,
      quantity: row.quantity,
      minThreshold: row.min_threshold,
      notes: row.notes ?? null,
      createdAt: new Date(row.created_at),
    }));
  },

  async add(data: Omit<Consumable, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase.from('consumables').insert({
      name: data.name,
      category: data.category,
      unit: data.unit,
      quantity: data.quantity,
      min_threshold: data.minThreshold,
      notes: data.notes ?? null,
    });
    if (error) throw error;
  },

  async update(id: string, data: Partial<Omit<Consumable, 'id' | 'createdAt' | 'quantity'>>): Promise<void> {
    const fields: Record<string, unknown> = {};
    if (data.name !== undefined) fields.name = data.name;
    if (data.category !== undefined) fields.category = data.category;
    if (data.unit !== undefined) fields.unit = data.unit;
    if (data.minThreshold !== undefined) fields.min_threshold = data.minThreshold;
    if ('notes' in data) fields.notes = data.notes ?? null;
    const { error } = await supabase.from('consumables').update(fields).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('consumables').delete().eq('id', id);
    if (error) throw error;
  },

  async addTransaction(
    consumableId: string,
    type: 'in' | 'out' | 'writeoff',
    delta: number,
    notes?: string,
  ): Promise<void> {
    const { error } = await supabase.from('consumable_transactions').insert({
      consumable_id: consumableId,
      type,
      delta,
      notes: notes?.trim() || null,
    });
    if (error) throw error;
  },

  async getTransactions(consumableId: string): Promise<ConsumableTransaction[]> {
    const { data, error } = await supabase
      .from('consumable_transactions')
      .select('*')
      .eq('consumable_id', consumableId)
      .order('recorded_at', { ascending: false });
    if (error) throw error;

    const rows = data ?? [];
    const userIds = [...new Set(rows.filter((r) => r.user_id).map((r) => r.user_id as string))];
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.rpc('get_profile_names', { ids: userIds });
      nameMap = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
    }

    return rows.map((row) => ({
      id: row.id,
      consumableId: row.consumable_id,
      type: row.type as 'in' | 'out' | 'writeoff',
      delta: row.delta,
      userName: row.user_id ? (nameMap[row.user_id] ?? null) : null,
      recordedAt: new Date(row.recorded_at),
      notes: row.notes ?? null,
    }));
  },
};
