import { supabase } from './supabase';

export interface Room {
  id: string;
  code: string;
  office: 'A' | 'B' | 'C';
  name: string;
  parentId: string | null;
  sortOrder: number;
  responsible: string;
}

export interface RoomTreeNode {
  id: string;
  code: string;
  office: 'A' | 'B' | 'C';
  name: string;
  parentId: string | null;
  sortOrder: number;
  responsible: string;
  children: RoomTreeNode[];
}

export const OFFICE_LABEL: Record<string, string> = {
  A: 'Романов-96',
  B: 'Знаменка-25',
  C: 'Знаменка-13',
};

function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: row.id as string,
    code: row.code as string,
    office: row.office as 'A' | 'B' | 'C',
    name: row.name as string,
    parentId: (row.parent_id as string) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    responsible: (row.responsible as string) ?? '',
  };
}

export function buildRoomTree(rooms: Room[]): RoomTreeNode[] {
  const map = new Map<string, RoomTreeNode>();
  rooms.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: RoomTreeNode[] = [];
  rooms.forEach((r) => {
    const node = map.get(r.id)!;
    if (r.parentId && map.has(r.parentId)) {
      map.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function findRoom(rooms: Room[], id: string): Room | undefined {
  return rooms.find((r) => r.id === id);
}

export function getRoomPath(rooms: Room[], roomId: string): string {
  const room = findRoom(rooms, roomId);
  if (!room) return '';
  const parts: string[] = [room.name];
  let current = room;
  while (current.parentId) {
    const parent = findRoom(rooms, current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  parts.unshift(OFFICE_LABEL[room.office] ?? room.office);
  return parts.join(' / ');
}

export const roomService = {
  async getAll(): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, code, office, name, parent_id, sort_order, responsible')
      .order('office')
      .order('sort_order');
    if (error) throw error;
    return (data ?? []).map((r) => mapRoom(r as Record<string, unknown>));
  },

  async updateResponsible(id: string, responsible: string): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .update({ responsible })
      .eq('id', id);
    if (error) throw error;
  },
};
