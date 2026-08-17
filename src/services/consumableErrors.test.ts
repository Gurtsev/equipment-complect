import { describe, expect, it } from 'vitest';
import {
  getConsumableTransactionErrorMessage,
  INSUFFICIENT_STOCK_MESSAGE,
} from './consumableErrors';

describe('getConsumableTransactionErrorMessage', () => {
  it('объясняет отказ при недостаточном остатке', () => {
    expect(getConsumableTransactionErrorMessage({
      code: 'P0001',
      message: 'INVENTORY_INSUFFICIENT_STOCK',
    })).toBe(INSUFFICIENT_STOCK_MESSAGE);
  });

  it('не показывает технические детали неизвестной ошибки', () => {
    expect(getConsumableTransactionErrorMessage(new Error('connection failed')))
      .toBe('Ошибка при записи операции');
  });
});
