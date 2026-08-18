const PROJECT_ERROR_MESSAGES: Array<[string, string]> = [
  ['INVENTORY_PROJECT_PERIOD_CONFLICT', 'Оборудование уже занято другим проектом на эти даты'],
  ['INVENTORY_PROJECT_LOAN_PERIOD_CONFLICT', 'На эти даты у оборудования уже запланирован займ'],
  ['INVENTORY_PROJECT_EQUIPMENT_ASSIGNED', 'Оборудование выдано сотруднику'],
  ['INVENTORY_INVALID_PROJECT_PERIOD', 'Дата окончания должна быть позже даты начала'],
  ['INVENTORY_PROJECT_EQUIPMENT_NOT_FOUND', 'Часть оборудования больше не существует'],
  ['INVENTORY_PROJECT_NOT_FOUND', 'Проект больше не существует'],
  ['INVENTORY_PROJECT_ALREADY_FINISHED', 'Завершённый проект нельзя изменять'],
  ['INVENTORY_PROJECT_INVALID_TRANSITION', 'Статус проекта уже изменился — обновите данные'],
  ['INVENTORY_PROJECT_EMPTY', 'Нельзя активировать проект без оборудования'],
  ['INVENTORY_PROJECT_COMPOSITION_CHANGED', 'Состав проекта уже изменился — обновите данные'],
  ['INVENTORY_PROJECT_REQUIRED_FIELDS', 'Заполните обязательные поля проекта'],
];

export function getProjectErrorMessage(error: unknown, fallback: string): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message)
    : '';
  return PROJECT_ERROR_MESSAGES.find(([code]) => message.includes(code))?.[1] ?? fallback;
}
