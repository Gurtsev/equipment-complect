import { supabase } from './supabase';
import { Project } from '../models/Project';

interface ProjectRow {
  id: string;
  name: string;
  client: string;
  start_date: string;
  end_date: string;
  location: string;
  responsible: string;
  status: string;
  notes: string;
  project_equipment: Array<{ equipment_id: string }>;
}

function toProject(row: ProjectRow): Project {
  return new Project({
    id: row.id,
    name: row.name,
    client: row.client,
    startDate: row.start_date ? new Date(row.start_date) : new Date(),
    endDate: row.end_date ? new Date(row.end_date) : new Date(),
    location: row.location,
    responsible: row.responsible,
    status: row.status as Project['status'],
    notes: row.notes,
    equipmentIds: (row.project_equipment ?? []).map((pe) => pe.equipment_id),
  });
}

function toProjectRpcParams(project: Project) {
  return {
    p_project_id: project.id,
    p_name: project.name,
    p_client: project.client,
    p_start_date: project.startDate.toISOString(),
    p_end_date: project.endDate.toISOString(),
    p_location: project.location,
    p_responsible: project.responsible,
    p_status: project.status,
    p_notes: project.notes,
    p_equipment_ids: [...new Set(project.equipmentIds)],
  };
}

export const projectService = {
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, client, start_date, end_date, location, responsible, status, notes, project_equipment(equipment_id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toProject);
  },

  async add(project: Project): Promise<void> {
    const { error: rpcError } = await supabase.rpc(
      'create_project_with_equipment',
      toProjectRpcParams(project),
    );
    if (rpcError) throw rpcError;
  },

  async update(project: Project): Promise<void> {
    const { error: rpcError } = await supabase.rpc(
      'update_project_with_equipment',
      toProjectRpcParams(project),
    );
    if (rpcError) throw rpcError;
  },

  async addEquipmentAtomic(
    projectId: string,
    equipmentIds: string[],
    listImport?: { listId: string; listName: string; skippedCount: number },
  ): Promise<number> {
    const { data, error } = await supabase.rpc('add_project_equipment', {
      p_project_id: projectId,
      p_equipment_ids: [...new Set(equipmentIds)],
      p_list_id: listImport?.listId ?? null,
      p_list_name: listImport?.listName ?? '',
      p_skipped_count: listImport?.skippedCount ?? 0,
    });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async removeEquipmentAtomic(projectId: string, equipmentIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('remove_project_equipment', {
      p_project_id: projectId,
      p_equipment_ids: [...new Set(equipmentIds)],
    });
    if (error) throw error;
  },

  async transitionAtomic(
    projectId: string,
    targetStatus: 'Активен' | 'Завершён',
  ): Promise<void> {
    const { error } = await supabase.rpc('transition_project', {
      p_project_id: projectId,
      p_target_status: targetStatus,
    });
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
