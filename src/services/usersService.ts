import { supabase } from './supabase';
import type { UserRole } from '../contexts/AuthContext';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
      .select('id, name, email, role')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async updateProfile(id: string, fields: Partial<Pick<Profile, 'name' | 'role'>>): Promise<void> {
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
      .select('id, email, domain, role, note, created_at')
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
