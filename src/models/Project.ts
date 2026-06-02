export type ProjectStatus = 'Планируется' | 'Активен' | 'Завершён';

export interface ProjectData {
  id: string;
  name: string;
  client: string;
  startDate: Date;
  endDate: Date;
  location: string;
  responsible: string;
  status: ProjectStatus;
  equipmentIds: string[];
  notes: string;
}

export class Project {
  readonly id: string;
  name: string;
  client: string;
  startDate: Date;
  endDate: Date;
  location: string;
  responsible: string;
  status: ProjectStatus;
  equipmentIds: string[];
  notes: string;

  constructor(data: ProjectData) {
    this.id = data.id;
    this.name = data.name;
    this.client = data.client;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.location = data.location;
    this.responsible = data.responsible;
    this.status = data.status;
    this.equipmentIds = data.equipmentIds;
    this.notes = data.notes;
  }
}
