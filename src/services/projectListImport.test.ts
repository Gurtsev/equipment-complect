import { describe, expect, it } from 'vitest';
import { Equipment } from '../models/Equipment';
import { analyzeProjectListImport } from './projectListImport';

function equipment(id: string): Equipment {
  return new Equipment({
    id,
    model: id,
    subtitle: '',
    category: 'camera',
    section: 'tech',
    description: '',
    image: '',
    invNumber: id,
    serialNumber: '',
    responsible: '',
    accessories: [],
    history: [],
  });
}

describe('analyzeProjectListImport', () => {
  it('пропускает позиции, уже находящиеся в проекте', () => {
    const rows = analyzeProjectListImport(['eq-1'], ['eq-1'], [equipment('eq-1')], () => null);
    expect(rows[0].reason).toBe('Уже в проекте');
  });

  it('помечает удалённую позицию списка как недоступную', () => {
    const rows = analyzeProjectListImport(['missing'], [], [], () => null);
    expect(rows[0].reason).toBe('Оборудование удалено');
  });

  it('сохраняет причину предметной блокировки', () => {
    const rows = analyzeProjectListImport(
      ['eq-1', 'eq-2'],
      [],
      [equipment('eq-1'), equipment('eq-2')],
      (item) => item.id === 'eq-2' ? 'В ремонте' : null,
    );
    expect(rows.map((row) => row.reason)).toEqual([null, 'В ремонте']);
  });
});

