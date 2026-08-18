import { supabase } from './supabase';
import { Project } from '../models/Project';
import { isMissingRpcFunction } from './rpcFallback';

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
    if (!rpcError) return;
    if (!isMissingRpcFunction(rpcError)) throw rpcError;

    // Rolling-deploy fallback until migration 030 is applied.
    const { error: projErr } = await supabase.from('projects').insert({
      id: project.id,
      name: project.name,
      client: project.client,
      start_date: project.startDate.toISOString(),
      end_date: project.endDate.toISOString(),
      location: project.location,
      responsible: project.responsible,
      status: project.status,
      notes: project.notes,
    });
    if (projErr) throw projErr;

    if (project.equipmentIds.length > 0) {
      const { error: peErr } = await supabase.from('project_equipment').insert(
        project.equipmentIds.map((eid) => ({ project_id: project.id, equipment_id: eid })),
      );
      if (peErr) throw peErr;
    }
  },

  async update(project: Project): Promise<void> {
    const { error: rpcError } = await supabase.rpc(
      'update_project_with_equipment',
      toProjectRpcParams(project),
    );
    if (!rpcError) return;
    if (!isMissingRpcFunction(rpcError)) throw rpcError;

    // Rolling-deploy fallback until migration 030 is applied.
    const { error: projErr } = await supabase
      .from('projects')
      .update({
        name: project.name,
        client: project.client,
        start_date: project.startDate.toISOString(),
        end_date: project.endDate.toISOString(),
        location: project.location,
        responsible: project.responsible,
        status: project.status,
        notes: project.notes,
      })
      .eq('id', project.id);
    if (projErr) throw projErr;

    // Diff-синхронизация: удалять только убранные, добавлять только новые
    const { data: current, error: fetchErr } = await supabase
      .from('project_equipment')
      .select('equipment_id')
      .eq('project_id', project.id);
    if (fetchErr) throw fetchErr;

    const currentIds = new Set((current ?? []).map((r) => r.equipment_id as string));
    const newIds = new Set(project.equipmentIds);

    const toDelete = [...currentIds].filter((id) => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('project_equipment')
        .delete()
        .eq('project_id', project.id)
        .in('equipment_id', toDelete);
      if (error) throw error;
    }

    const toInsert = [...newIds].filter((id) => !currentIds.has(id));
    if (toInsert.length > 0) {
      const { error } = await supabase.from('project_equipment').insert(
        toInsert.map((eid) => ({ project_id: project.id, equipment_id: eid })),
      );
      if (error) throw error;
    }
  },

  async addEquipmentAtomic(
    projectId: string,
    equipmentIds: string[],
    listImport?: { listId: string; listName: string; skippedCount: number },
  ): Promise<number | null> {
    const { data, error } = await supabase.rpc('add_project_equipment', {
      p_project_id: projectId,
      p_equipment_ids: [...new Set(equipmentIds)],
      p_list_id: listImport?.listId ?? null,
      p_list_name: listImport?.listName ?? '',
      p_skipped_count: listImport?.skippedCount ?? 0,
    });
    if (!error) return Number(data ?? 0);
    if (isMissingRpcFunction(error)) return null;
    throw error;
  },

  async removeEquipmentAtomic(projectId: string, equipmentIds: string[]): Promise<boolean> {
    const { error } = await supabase.rpc('remove_project_equipment', {
      p_project_id: projectId,
      p_equipment_ids: [...new Set(equipmentIds)],
    });
    if (!error) return true;
    if (isMissingRpcFunction(error)) return false;
    throw error;
  },

  async transitionAtomic(
    projectId: string,
    targetStatus: 'Активен' | 'Завершён',
  ): Promise<boolean> {
    const { error } = await supabase.rpc('transition_project', {
      p_project_id: projectId,
      p_target_status: targetStatus,
    });
    if (!error) return true;
    if (isMissingRpcFunction(error)) return false;
    throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
