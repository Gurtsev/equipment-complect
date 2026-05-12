import { Equipment, EquipmentCategory } from './Equipment';

export class EquipmentRepository {
  private readonly items: Equipment[];

  constructor(items: Equipment[]) {
    this.items = items;
  }

  getAll(): Equipment[] {
    return this.items;
  }

  getById(id: string): Equipment | undefined {
    return this.items.find((item) => item.id === id);
  }

  filter(category: EquipmentCategory | 'all', query: string): Equipment[] {
    const q = query.toLowerCase().trim();
    return this.items.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      const matchesSearch =
        !q ||
        item.model.toLowerCase().includes(q) ||
        item.invNumber.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  countByCategory(category: EquipmentCategory | 'all', query: string): number {
    return this.filter(category, query).length;
  }

  add(equipment: Equipment): void {
    this.items.push(equipment);
  }
}
