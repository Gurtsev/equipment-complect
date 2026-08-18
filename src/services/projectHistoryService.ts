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

const LIST_IMPORT_COLUMNS =
  'id, project_id, user_id, action, equipment_id, equipment_name, recorded_at, list_id, list_name, imported_count, skipped_count';

interface HistoryRow {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  equipment_id: string | null;
  equipment_name: string | null;
  recorded_at: string;
  list_id?: string | null;
  list_name?: string | null;
  imported_count?: number | null;
  skipped_count?: number | null;
}

export const projectHistoryService = {
  async getForProject(projectId: string): Promise<ProjectHistoryEntry[]> {
    const { data, error } = await supabase
      .from('project_history')
      .select(LIST_IMPORT_COLUMNS)
      .eq('project_id', projectId)
      .order('recorded_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = (data ?? []) as unknown as HistoryRow[];

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.rpc('get_profile_names', { ids: userIds });
      for (const p of profiles ?? []) nameById.set(p.id, p.name);
    }

    return rows.map((r) => ({
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
