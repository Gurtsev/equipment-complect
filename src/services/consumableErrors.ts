export const INSUFFICIENT_STOCK_MESSAGE = 'Недостаточно остатка для этой операции';

export function getConsumableTransactionErrorMessage(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof error.message === 'string'
    && error.message.includes('INVENTORY_INSUFFICIENT_STOCK')
  ) {
    return INSUFFICIENT_STOCK_MESSAGE;
  }

  return 'Ошибка при записи операции';
}
