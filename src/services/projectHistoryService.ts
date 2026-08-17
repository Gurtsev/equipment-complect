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

const BASE_HISTORY_COLUMNS =
  'id, project_id, user_id, action, equipment_id, equipment_name, recorded_at';
const LIST_IMPORT_COLUMNS =
  `${BASE_HISTORY_COLUMNS}, list_id, list_name, imported_count, skipped_count`;

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
    const payload: Record<string, unknown> = {
      project_id: projectId,
      action,
      equipment_id: options?.equipmentId ?? null,
      equipment_name: options?.equipmentName ?? null,
    };
    if (action === 'list_imported') {
      payload.list_id = options?.listId ?? null;
      payload.list_name = options?.listName ?? null;
      payload.imported_count = options?.importedCount ?? 0;
      payload.skipped_count = options?.skippedCount ?? 0;
    }
    const { error } = await supabase.from('project_history').insert(payload);
    if (error) throw error;
  },

  async supportsListImports(): Promise<boolean> {
    const { error } = await supabase
      .from('project_history')
      .select('list_id')
      .limit(1);
    return !error;
  },

  async getForProject(projectId: string): Promise<ProjectHistoryEntry[]> {
    const extendedResult = await supabase
      .from('project_history')
      .select(LIST_IMPORT_COLUMNS)
      .eq('project_id', projectId)
      .order('recorded_at', { ascending: false })
      .limit(100);

    // Во время rolling deploy frontend может обновиться раньше миграции 024.
    // В этом случае сохраняем доступ к прежней истории проекта.
    let rows: HistoryRow[];
    if (extendedResult.error) {
      const legacyResult = await supabase
        .from('project_history')
        .select(BASE_HISTORY_COLUMNS)
        .eq('project_id', projectId)
        .order('recorded_at', { ascending: false })
        .limit(100);
      if (legacyResult.error) throw legacyResult.error;
      rows = (legacyResult.data ?? []) as unknown as HistoryRow[];
    } else {
      rows = (extendedResult.data ?? []) as unknown as HistoryRow[];
    }

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
