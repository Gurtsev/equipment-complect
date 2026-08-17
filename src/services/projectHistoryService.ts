import { supabase } from './supabase';

export type ProjectHistoryAction =
  | 'equipment_added'
  | 'equipment_removed'
  | 'activated'
  | 'finished'
  | 'created'
  | 'updated'
  | 'list_imported';

export interface ProjectHistoryEntry {
  id: string;
  projectId: string;
  userId: string | null;
  userName?: string;
  action: ProjectHistoryAction;
  equipmentId?: string;
  equipmentName?: string;
  listId?: string;
  listName?: string;
  importedCount?: number;
  skippedCount?: number;
  recordedAt: Date;
}

export const projectHistoryService = {
  async addEntry(
    projectId: string,
    action: ProjectHistoryAction,
    options?: {
      equipmentId?: string;
      equipmentName?: string;
      listId?: string;
      listName?: string;
      importedCount?: number;
      skippedCount?: number;
    },
  ): Promise<void> {
    const { error } = await supabase.from('project_history').insert({
      project_id: projectId,
      action,
      equipment_id: options?.equipmentId ?? null,
      equipment_name: options?.equipmentName ?? null,
      list_id: options?.listId ?? null,
      list_name: options?.listName ?? null,
      imported_count: options?.importedCount ?? null,
      skipped_count: options?.skippedCount ?? null,
    });
    if (error) throw error;
  },

  async getForProject(projectId: string): Promise<ProjectHistoryEntry[]> {
    const { data, error } = await supabase
      .from('project_history')
      .select('id, project_id, user_id, action, equipment_id, equipment_name, list_id, list_name, imported_count, skipped_count, recorded_at')
      .eq('project_id', projectId)
      .order('recorded_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.rpc('get_profile_names', { ids: userIds });
      for (const p of profiles ?? []) nameById.set(p.id, p.name);
    }

    return (data ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      userId: r.user_id,
      userName: r.user_id ? nameById.get(r.user_id) : undefined,
      action: r.action as ProjectHistoryAction,
      equipmentId: r.equipment_id ?? undefined,
      equipmentName: r.equipment_name ?? undefined,
      listId: r.list_id ?? undefined,
      listName: r.list_name ?? undefined,
      importedCount: r.imported_count ?? undefined,
      skippedCount: r.skipped_count ?? undefined,
      recordedAt: new Date(r.recorded_at),
    }));
  },
};
