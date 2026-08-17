const CUSTODY_ERROR_MESSAGES: Array<[string, string]> = [
  ['INVENTORY_ACTIVE_ASSIGNMENT_EXISTS', 'Оборудование уже выдано сотруднику'],
  ['INVENTORY_OPEN_LOAN_EXISTS', 'По оборудованию уже есть открытый или запланированный займ'],
  ['INVENTORY_LOAN_PERIOD_CONFLICT', 'Период займа пересекается с другим займом'],
  ['INVENTORY_INVALID_LOAN_PERIOD', 'Дата возврата должна быть позже даты начала'],
];

export function getCustodyErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  const errorMessage = error.message;
  if (typeof errorMessage !== 'string') return fallback;

  return CUSTODY_ERROR_MESSAGES.find(([code]) => errorMessage.includes(code))?.[1] ?? fallback;
}
