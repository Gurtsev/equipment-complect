import type { Equipment } from '../models/Equipment';

export interface ProjectListImportRow {
  equipmentId: string;
  equipment?: Equipment;
  reason: string | null;
}

export function analyzeProjectListImport(
  listEquipmentIds: string[],
  projectEquipmentIds: string[],
  allEquipment: Equipment[],
  getUnavailableReason: (equipment: Equipment) => string | null,
): ProjectListImportRow[] {
  const projectIds = new Set(projectEquipmentIds);
  const equipmentById = new Map(allEquipment.map((equipment) => [equipment.id, equipment]));

  return listEquipmentIds.map((equipmentId) => {
    const equipment = equipmentById.get(equipmentId);
    let reason: string | null = null;
    if (projectIds.has(equipmentId)) reason = 'Уже в проекте';
    else if (!equipment) reason = 'Оборудование удалено';
    else reason = getUnavailableReason(equipment);
    return { equipmentId, equipment, reason };
  });
}

