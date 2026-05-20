import { supabase } from './supabase';
import type { UserRole } from '../contexts/AuthContext';
import type { EquipmentDepartment } from '../models/Equipment';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: EquipmentDepartment | null;
}

export interface AllowedEntry {
  id: string;
  email: string | null;
  domain: string | null;
  role: UserRole;
  note: string | null;
  created_at: string;
}

export const usersService = {
  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, department')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async updateProfile(id: string, fields: Partial<Pick<Profile, 'name' | 'role' | 'department'>>): Promise<void> {
    const { error } = await supabase.from('profiles').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteProfile(id: string): Promise<void> {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  },

  async getAllowedEntries(): Promise<AllowedEntry[]> {
    const { data, error } = await supabase
      .from('allowed_emails')
      .select('*')
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as AllowedEntry[];
  },

  async addAllowedEntry(entry: Pick<AllowedEntry, 'email' | 'domain' | 'role' | 'note'>): Promise<void> {
    const { error } = await supabase.from('allowed_emails').insert(entry);
    if (error) throw error;
  },

  async updateAllowedEntry(id: string, fields: Partial<Pick<AllowedEntry, 'role' | 'note'>>): Promise<void> {
    const { error } = await supabase.from('allowed_emails').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteAllowedEntry(id: string): Promise<void> {
    const { error } = await supabase.from('allowed_emails').delete().eq('id', id);
    if (error) throw error;
  },
};
