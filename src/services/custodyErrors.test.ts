import { describe, expect, it } from 'vitest';
import { getCustodyErrorMessage } from './custodyErrors';

describe('getCustodyErrorMessage', () => {
  it.each([
    ['INVENTORY_ACTIVE_ASSIGNMENT_EXISTS', 'Оборудование уже выдано сотруднику'],
    ['INVENTORY_OPEN_LOAN_EXISTS', 'По оборудованию уже есть открытый или запланированный займ'],
    ['INVENTORY_LOAN_PERIOD_CONFLICT', 'Период займа пересекается с другим займом'],
    ['INVENTORY_INVALID_LOAN_PERIOD', 'Дата возврата должна быть позже даты начала'],
  ])('преобразует серверный код %s', (code, expected) => {
    expect(getCustodyErrorMessage({ message: code }, 'Ошибка')).toBe(expected);
  });

  it('возвращает безопасный текст для неизвестной ошибки', () => {
    expect(getCustodyErrorMessage(new Error('database details'), 'Ошибка при выдаче'))
      .toBe('Ошибка при выдаче');
  });
});
