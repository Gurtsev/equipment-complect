export type InventoryDeepLink =
  | { type: 'equipment'; value: string }
  | { type: 'room'; value: string };

export interface ParsedInventoryDeepLink {
  target: InventoryDeepLink | null;
  remainingSearch: string;
  hadInventoryParams: boolean;
}

const EQUIPMENT_ID_PATTERN = /^EQP-\d{4,10}$/;
const ROOM_CODE_PATTERN = /^[ABC](?:-\d{2})+$/;

export function parseInventoryDeepLink(search: string): ParsedInventoryDeepLink {
  const params = new URLSearchParams(search);
  const hadInventoryParams = params.has('eq') || params.has('room');
  const equipmentId = params.get('eq')?.trim().toUpperCase() ?? '';
  const roomCode = params.get('room')?.trim().toUpperCase() ?? '';

  let target: InventoryDeepLink | null = null;
  if (EQUIPMENT_ID_PATTERN.test(equipmentId)) {
    target = { type: 'equipment', value: equipmentId };
  } else if (ROOM_CODE_PATTERN.test(roomCode)) {
    target = { type: 'room', value: roomCode };
  }

  params.delete('eq');
  params.delete('room');
  const remainder = params.toString();

  return {
    target,
    remainingSearch: remainder ? `?${remainder}` : '',
    hadInventoryParams,
  };
}
