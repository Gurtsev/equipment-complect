import { supabase } from './supabase';

export interface EquipmentList {
  id: string;
  name: string;
  userId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  equipmentIds: string[];
}

export interface LoanConflictEvent {
  id: string;
  loanId: string;
  equipmentId: string;
  projectId: string;
  isRead: boolean;
  createdAt: Date;
}

interface ListRow {
  id: string;
  name: string;
  user_id: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  equipment_list_items: Array<{ equipment_id: string }>;
}

function mapList(row: ListRow): EquipmentList {
  return {
    id: row.id,
    name: row.name,
    userId: row.user_id,
    isArchived: row.is_archived,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    equipmentIds: (row.equipment_list_items ?? []).map((i) => i.equipment_id),
  };
}

export const listService = {
  async getAll(): Promise<EquipmentList[]> {
    const { data, error } = await supabase
      .from('equipment_lists')
      .select('id, name, user_id, is_archived, created_at, updated_at, equipment_list_items(equipment_id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapList(r as unknown as ListRow));
  },

  async create(name: string, equipmentIds: string[]): Promise<EquipmentList> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: list, error } = await supabase
      .from('equipment_lists')
      .insert({ name, user_id: user?.id })
      .select('id, name, user_id, is_archived, created_at, updated_at, equipment_list_items(equipment_id)')
      .single();
    if (error) throw error;

    if (equipmentIds.length > 0) {
      const { error: itemsErr } = await supabase
        .from('equipment_list_items')
        .insert(equipmentIds.map((eid) => ({ list_id: list.id, equipment_id: eid })));
      if (itemsErr) throw itemsErr;
    }

    return mapList({ ...(list as unknown as ListRow), equipment_list_items: equipmentIds.map((eid) => ({ equipment_id: eid })) });
  },

  async addToExisting(listId: string, equipmentIds: string[]): Promise<void> {
    if (equipmentIds.length === 0) return;
    const { error } = await supabase
      .from('equipment_list_items')
      .insert(equipmentIds.map((eid) => ({ list_id: listId, equipment_id: eid })));
    if (error && !error.message.includes('unique')) throw error;
  },

  async copyAsTemplate(listId: string, newName: string): Promise<EquipmentList> {
    const { data, error } = await supabase
      .from('equipment_lists')
      .select('id, name, user_id, is_archived, created_at, updated_at, equipment_list_items(equipment_id)')
      .eq('id', listId)
      .single();
    if (error) throw error;
    const original = mapList(data as unknown as ListRow);
    return listService.create(newName, original.equipmentIds);
  },

  async rename(listId: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('equipment_lists')
      .update({ name })
      .eq('id', listId);
    if (error) throw error;
  },

  async archive(listId: string): Promise<void> {
    const { error } = await supabase
      .from('equipment_lists')
      .update({ is_archived: true })
      .eq('id', listId);
    if (error) throw error;
  },

  async removeItem(listId: string, equipmentId: string): Promise<void> {
    const { error } = await supabase
      .from('equipment_list_items')
      .delete()
      .eq('list_id', listId)
      .eq('equipment_id', equipmentId);
    if (error) throw error;
  },

  async addItems(listId: string, equipmentIds: string[]): Promise<void> {
    if (equipmentIds.length === 0) return;
    const { error } = await supabase
      .from('equipment_list_items')
      .insert(equipmentIds.map((eid) => ({ list_id: listId, equipment_id: eid })));
    if (error && !error.message.includes('unique')) throw error;
  },

  async delete(listId: string): Promise<void> {
    const { error } = await supabase.from('equipment_lists').delete().eq('id', listId);
    if (error) throw error;
  },

  // Проверка конфликтов по проектам: возвращает equipment_id, уже занятые на эти даты
  async getProjectConflicts(
    equipmentIds: string[],
    startDate: Date,
    endDate: Date,
    excludeProjectId?: string,
  ): Promise<Set<string>> {
    if (equipmentIds.length === 0) return new Set();

    const { data, error } = await supabase
      .from('project_equipment')
      .select('equipment_id, projects!inner(id, start_date, end_date, status)')
      .in('equipment_id', equipmentIds)
      .in('projects.status', ['Планируется', 'Активен']);
    if (error) throw error;

    const conflicted = new Set<string>();
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const proj = row.projects as { id: string; start_date: string; end_date: string };
      if (excludeProjectId && proj.id === excludeProjectId) continue;
      const pStart = new Date(proj.start_date);
      const pEnd = new Date(proj.end_date);
      // Пересечение: A.start < B.end AND A.end > B.start
      if (startDate < pEnd && endDate > pStart) {
        conflicted.add(row.equipment_id as string);
      }
    }
    return conflicted;
  },

  // Проверка конфликтов по займам: только уже выданные (start_date <= now)
  async getLoanConflicts(
    equipmentIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Set<string>> {
    if (equipmentIds.length === 0) return new Set();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('equipment_loans')
      .select('equipment_id, start_date, due_date')
      .in('equipment_id', equipmentIds)
      .is('returned_at', null)
      .lte('start_date', now);
    if (error) throw error;

    const conflicted = new Set<string>();
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const lStart = new Date(row.start_date as string);
      const lEnd = row.due_date ? new Date(row.due_date as string) : new Date('9999-12-31');
      if (startDate < lEnd && endDate > lStart) {
        conflicted.add(row.equipment_id as string);
      }
    }
    return conflicted;
  },

  // Уведомления о конфликтах займов
  async getConflictEvents(): Promise<LoanConflictEvent[]> {
    const { data, error } = await supabase
      .from('loan_conflict_events')
      .select('id, loan_id, equipment_id, project_id, is_read, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      loanId: row.loan_id as string,
      equipmentId: row.equipment_id as string,
      projectId: row.project_id as string,
      isRead: row.is_read as boolean,
      createdAt: new Date(row.created_at as string),
    }));
  },

  async markConflictRead(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('loan_conflict_events')
      .update({ is_read: true })
      .eq('id', eventId);
    if (error) throw error;
  },

  async createConflictEvent(params: {
    userId: string;
    loanId: string;
    equipmentId: string;
    projectId: string;
  }): Promise<void> {
    const { error } = await supabase.from('loan_conflict_events').insert({
      user_id: params.userId,
      loan_id: params.loanId,
      equipment_id: params.equipmentId,
      project_id: params.projectId,
    });
    if (error) throw error;
  },
};
