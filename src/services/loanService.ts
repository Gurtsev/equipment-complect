import { supabase } from './supabase';
import { historyService } from './historyService';
import type { EquipmentDepartment, EquipmentStatus, EquipmentLocation } from '../models/Equipment';

export type LoanType = 'employee' | 'department';

export interface Loan {
  id: string;
  equipmentId: string;
  loanType: LoanType;
  toProfileId: string | null;
  toProfileName: string | null;
  toDepartment: EquipmentDepartment | null;
  fromDepartment: EquipmentDepartment;
  projectId: string | null;
  issuedByName: string | null;
  issuedAt: Date;
  dueDate: Date | null;
  returnedAt: Date | null;
  notes: string | null;
}

export interface EquipmentLoanSummary {
  id: string;
  equipmentId: string;
  equipmentModel: string;
  equipmentInvNumber: string;
  equipmentImage: string | null;
  loanType: LoanType;
  toDepartment: EquipmentDepartment | null;
  fromDepartment: EquipmentDepartment;
  issuedAt: Date;
  dueDate: Date | null;
  notes: string | null;
}

function mapLoan(row: Record<string, unknown>, profiles: Record<string, string>): Loan {
  return {
    id: row.id as string,
    equipmentId: row.equipment_id as string,
    loanType: row.loan_type as LoanType,
    toProfileId: (row.to_profile_id as string) ?? null,
    toProfileName: row.to_profile_id ? (profiles[row.to_profile_id as string] ?? null) : null,
    toDepartment: (row.to_department as EquipmentDepartment) ?? null,
    fromDepartment: row.from_department as EquipmentDepartment,
    projectId: (row.project_id as string) ?? null,
    issuedByName: row.issued_by ? (profiles[row.issued_by as string] ?? null) : null,
    issuedAt: new Date(row.issued_at as string),
    dueDate: row.due_date ? new Date(row.due_date as string) : null,
    returnedAt: row.returned_at ? new Date(row.returned_at as string) : null,
    notes: (row.notes as string) ?? null,
  };
}

async function resolveNames(rows: Record<string, unknown>[]): Promise<Record<string, string>> {
  const ids = new Set<string>();
  rows.forEach((r) => {
    if (r.to_profile_id) ids.add(r.to_profile_id as string);
    if (r.issued_by) ids.add(r.issued_by as string);
  });
  if (ids.size === 0) return {};
  const { data } = await supabase.from('profiles').select('id, name').in('id', [...ids]);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, p.name as string]));
}

export const loanService = {
  async getActiveLoan(equipmentId: string): Promise<Loan | null> {
    const { data, error } = await supabase
      .from('equipment_loans')
      .select('*')
      .eq('equipment_id', equipmentId)
      .is('returned_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const names = await resolveNames([data as Record<string, unknown>]);
    return mapLoan(data as Record<string, unknown>, names);
  },

  async getLoansForEquipment(equipmentId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from('equipment_loans')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    const names = await resolveNames(rows);
    return rows.map((r) => mapLoan(r, names));
  },

  async getActiveLoansForProfile(profileId: string): Promise<EquipmentLoanSummary[]> {
    const { data, error } = await supabase
      .from('equipment_loans')
      .select('*, equipment!equipment_id(model, inv_number, image)')
      .eq('to_profile_id', profileId)
      .is('returned_at', null)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      equipmentId: row.equipment_id as string,
      equipmentModel: (row.equipment as Record<string, unknown>)?.model as string ?? '',
      equipmentInvNumber: (row.equipment as Record<string, unknown>)?.inv_number as string ?? '',
      equipmentImage: (row.equipment as Record<string, unknown>)?.image as string ?? null,
      loanType: row.loan_type as LoanType,
      toDepartment: null,
      fromDepartment: row.from_department as EquipmentDepartment,
      issuedAt: new Date(row.issued_at as string),
      dueDate: row.due_date ? new Date(row.due_date as string) : null,
      notes: (row.notes as string) ?? null,
    }));
  },

  async create(params: {
    equipmentId: string;
    loanType: LoanType;
    toProfileId?: string;
    toDepartment?: EquipmentDepartment;
    fromDepartment: EquipmentDepartment;
    projectId?: string;
    dueDate?: string;
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase.from('equipment_loans').insert({
      equipment_id: params.equipmentId,
      loan_type: params.loanType,
      to_profile_id: params.toProfileId ?? null,
      to_department: params.toDepartment ?? null,
      from_department: params.fromDepartment,
      project_id: params.projectId ?? null,
      due_date: params.dueDate ?? null,
      notes: params.notes?.trim() || null,
    });
    if (error) throw error;

    const status: EquipmentStatus = params.loanType === 'employee' ? 'Выдан' : 'В Работе';
    await historyService.addEntry(params.equipmentId, status, '' as EquipmentLocation, '');
  },

  async returnLoan(loanId: string, equipmentId: string): Promise<void> {
    const { error } = await supabase
      .from('equipment_loans')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', loanId);
    if (error) throw error;
    await historyService.addEntry(equipmentId, 'На Складе', 'Склад', '');
  },
};
