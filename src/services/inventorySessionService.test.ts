import { describe, expect, it } from 'vitest';
import { normalizeInventoryCode } from './inventorySessionService';

describe('normalizeInventoryCode', () => {
  it('принимает обычный ID и инвентарный номер', () => {
    expect(normalizeInventoryCode('  EQP-0042  ')).toBe('EQP-0042');
    expect(normalizeInventoryCode('ИНВ-123')).toBe('ИНВ-123');
  });

  it('извлекает ID оборудования из полной QR-ссылки', () => {
    expect(normalizeInventoryCode('https://inventory.knzteam.ru/?eq=EQP-0042'))
      .toBe('EQP-0042');
  });

  it('не изменяет постороннюю строку и отбрасывает пустое значение', () => {
    expect(normalizeInventoryCode('not-a-url')).toBe('not-a-url');
    expect(normalizeInventoryCode('   ')).toBe('');
  });
});
