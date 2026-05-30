export type EquipmentStatus = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути' | 'Забронировано' | 'Выдан';
export type EquipmentLocation =
  | 'Склад'
  | 'Ремонт'
  | 'В пути'
  | 'На руках'
  | 'Офис';
export type EquipmentCategory =
  | 'camera'
  | 'microphone'
  | 'light'
  | 'computer'
  | 'audio'
  | 'accessory'
  | 'optics'
  | 'phone'
  | 'furniture'
  | 'prop'
  | 'tool';
export type EquipmentDepartment = 'studio' | 'aho' | 'office';

export interface HistoryEntry {
  date: Date;
  status: EquipmentStatus;
  location: EquipmentLocation;
  responsible: string;
  userName?: string;
}

export interface EquipmentData {
  id: string;
  model: string;
  subtitle: string;
  category: EquipmentCategory;
  department: EquipmentDepartment;
  description: string;
  image: string;
  invNumber: string;
  serialNumber: string;
  responsible: string;
  accessories: string[];
  history: HistoryEntry[];
  roomId?: string | null;
}

export class Equipment {
  readonly id: string;
  readonly model: string;
  readonly subtitle: string;
  readonly category: EquipmentCategory;
  readonly department: EquipmentDepartment;
  readonly description: string;
  readonly image: string;
  readonly invNumber: string;
  readonly serialNumber: string;
  responsible: string;
  readonly accessories: string[];
  history: HistoryEntry[];
  roomId: string | null;

  constructor(data: EquipmentData) {
    this.id = data.id;
    this.model = data.model;
    this.subtitle = data.subtitle;
    this.category = data.category;
    this.department = data.department;
    this.description = data.description;
    this.image = data.image;
    this.invNumber = data.invNumber;
    this.serialNumber = data.serialNumber;
    this.responsible = data.responsible;
    this.accessories = data.accessories;
    this.history = data.history;
    this.roomId = data.roomId ?? null;
  }

  get currentStatus(): EquipmentStatus {
    return this.history[0]?.status ?? 'На Складе';
  }

  get currentLocation(): EquipmentLocation {
    return this.history[0]?.location ?? 'Склад';
  }

  addHistoryEntry(
    status: EquipmentStatus,
    location: EquipmentLocation,
    responsible: string
  ): HistoryEntry {
    const entry: HistoryEntry = { date: new Date(), status, location, responsible };
    this.history = [entry, ...this.history];
    return entry;
  }
}
