import { Project } from './Project';

export class ProjectRepository {
  private readonly items: Project[];

  constructor(items: Project[]) {
    this.items = items;
  }

  getAll(): Project[] {
    return this.items;
  }

  getById(id: string): Project | undefined {
    return this.items.find((p) => p.id === id);
  }

  // Возвращает активный или планируемый проект, в котором числится эта единица
  getByEquipmentId(equipmentId: string): Project | undefined {
    return this.items.find(
      (p) =>
        p.equipmentIds.includes(equipmentId) &&
        (p.status === 'Планируется' || p.status === 'Активен'),
    );
  }

  add(project: Project): void {
    this.items.push(project);
  }

  replace(id: string, project: Project): void {
    const index = this.items.findIndex((p) => p.id === id);
    if (index !== -1) this.items[index] = project;
  }

  remove(id: string): void {
    const index = this.items.findIndex((p) => p.id === id);
    if (index !== -1) this.items.splice(index, 1);
  }
}
