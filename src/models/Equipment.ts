export type EquipmentStatus = 'В Работе' | 'На Складе' | 'В Ремонте' | 'Списано' | 'В Пути';
export type EquipmentLocation =
  | 'Студия Медиа Крыша'
  | 'Студия на Романовом'
  | 'Склад'
  | 'Ремонт'
  | 'В пути';
export type EquipmentCategory =
  | 'camera'
  | 'microphone'
  | 'light'
  | 'computer'
  | 'audio'
  | 'accessory'
  | 'optics';

export interface HistoryEntry {
  date: Date;
  status: EquipmentStatus;
  location: EquipmentLocation;
  responsible: string;
}

export interface EquipmentData {
  id: string;
  model: string;
  subtitle: string;
  category: EquipmentCategory;
  description: string;
  image: string;
  invNumber: string;
  serialNumber: string;
  responsible: string;
  accessories: string[];
  history: HistoryEntry[];
}

export class Equipment {
  readonly id: string;
  readonly model: string;
  readonly subtitle: string;
  readonly category: EquipmentCategory;
  readonly description: string;
  readonly image: string;
  readonly invNumber: string;
  readonly serialNumber: string;
  responsible: string;
  readonly accessories: string[];
  history: HistoryEntry[];

  constructor(data: EquipmentData) {
    this.id = data.id;
    this.model = data.model;
    this.subtitle = data.subtitle;
    this.category = data.category;
    this.description = data.description;
    this.image = data.image;
    this.invNumber = data.invNumber;
    this.serialNumber = data.serialNumber;
    this.responsible = data.responsible;
    this.accessories = data.accessories;
    this.history = data.history;
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
