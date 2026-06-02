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
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
    location: row.location,
    responsible: row.responsible,
    status: row.status as Project['status'],
    notes: row.notes,
    equipmentIds: (row.project_equipment ?? []).map((pe) => pe.equipment_id),
  });
}

export const projectService = {
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_equipment(equipment_id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toProject);
  },

  async add(project: Project): Promise<void> {
    const { error: projErr } = await supabase.from('projects').insert({
      id: project.id,
      name: project.name,
      client: project.client,
      start_date: project.startDate.toISOString().slice(0, 10),
      end_date: project.endDate.toISOString().slice(0, 10),
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
    const { error: projErr } = await supabase
      .from('projects')
      .update({
        name: project.name,
        client: project.client,
        start_date: project.startDate.toISOString().slice(0, 10),
        end_date: project.endDate.toISOString().slice(0, 10),
        location: project.location,
        responsible: project.responsible,
        status: project.status,
        notes: project.notes,
      })
      .eq('id', project.id);
    if (projErr) throw projErr;

    // Синхронизация project_equipment: удалить всё → вставить заново
    const { error: delErr } = await supabase
      .from('project_equipment')
      .delete()
      .eq('project_id', project.id);
    if (delErr) throw delErr;

    if (project.equipmentIds.length > 0) {
      const { error: peErr } = await supabase.from('project_equipment').insert(
        project.equipmentIds.map((eid) => ({ project_id: project.id, equipment_id: eid })),
      );
      if (peErr) throw peErr;
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
