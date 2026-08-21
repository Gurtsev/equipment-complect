import { supabase } from './supabase';

export type InventorySessionStatus = 'draft' | 'in_progress' | 'review' | 'completed' | 'cancelled';
export type InventoryItemResult = 'pending' | 'found' | 'misplaced' | 'accounted_elsewhere' | 'missing' | 'unexpected';
export type InventoryExpectedContext = 'room' | 'assignment' | 'loan' | 'project' | 'unexpected';

export interface InventorySession {
  id: string;
  name: string;
  roomId: string;
  includeDescendants: boolean;
  status: InventorySessionStatus;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
}

export interface InventorySessionItem {
  id: number;
  sessionId: string;
  equipmentId: string;
  expectedRoomId: string | null;
  expectedStatus: string;
  expectedResponsible: string;
  expectedContext: InventoryExpectedContext;
  result: InventoryItemResult;
  actualRoomId: string | null;
  scannedAt: string | null;
  note: string;
}

export interface InventoryScanResult {
  equipmentId: string | null;
  result: InventoryItemResult | 'duplicate' | 'unknown';
  duplicate: boolean;
}

export function normalizeInventoryCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, window.location.origin);
    return url.searchParams.get('eq')?.trim() || trimmed;
  } catch {
    return trimmed;
  }
}

function mapSession(row: Record<string, unknown>): InventorySession {
  return {
    id: row.id as string,
    name: row.name as string,
    roomId: row.room_id as string,
    includeDescendants: row.include_descendants as boolean,
    status: row.status as InventorySessionStatus,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    notes: (row.notes as string) ?? '',
  };
}

function mapItem(row: Record<string, unknown>): InventorySessionItem {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    equipmentId: row.equipment_id as string,
    expectedRoomId: (row.expected_room_id as string) ?? null,
    expectedStatus: (row.expected_status as string) ?? '',
    expectedResponsible: (row.expected_responsible as string) ?? '',
    expectedContext: row.expected_context as InventoryExpectedContext,
    result: row.result as InventoryItemResult,
    actualRoomId: (row.actual_room_id as string) ?? null,
    scannedAt: (row.scanned_at as string) ?? null,
    note: (row.note as string) ?? '',
  };
}

export const inventorySessionService = {
  async getAll(): Promise<InventorySession[]> {
    const { data, error } = await supabase
      .from('inventory_sessions')
      .select('id, name, room_id, include_descendants, status, created_by, created_at, started_at, completed_at, notes')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapSession(row as Record<string, unknown>));
  },

  async getItems(sessionId: string): Promise<InventorySessionItem[]> {
    const { data, error } = await supabase
      .from('inventory_session_items')
      .select('id, session_id, equipment_id, expected_room_id, expected_status, expected_responsible, expected_context, result, actual_room_id, scanned_at, note')
      .eq('session_id', sessionId)
      .order('id');
    if (error) throw error;
    return (data ?? []).map((row) => mapItem(row as Record<string, unknown>));
  },

  async create(name: string, roomId: string, notes = ''): Promise<string> {
    const { data, error } = await supabase.rpc('create_inventory_session', {
      p_name: name,
      p_room_id: roomId,
      p_include_descendants: true,
      p_notes: notes,
    });
    if (error) throw error;
    return data as string;
  },

  async scan(sessionId: string, code: string, actualRoomId: string): Promise<InventoryScanResult> {
    const { data, error } = await supabase.rpc('scan_inventory_item', {
      p_session_id: sessionId,
      p_code: code,
      p_actual_room_id: actualRoomId,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
    return {
      equipmentId: (row?.equipment_id as string) ?? null,
      result: row?.result as InventoryScanResult['result'],
      duplicate: Boolean(row?.duplicate),
    };
  },

  async finish(sessionId: string): Promise<number> {
    const { data, error } = await supabase.rpc('finish_inventory_session', { p_session_id: sessionId });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async cancel(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_inventory_session', { p_session_id: sessionId });
    if (error) throw error;
  },
};
