import { describe, expect, it } from 'vitest';
import { getProjectErrorMessage } from './projectErrors';

describe('getProjectErrorMessage', () => {
  it.each([
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
  ])('преобразует серверный код %s', (code, expected) => {
    expect(getProjectErrorMessage({ message: code }, 'Ошибка')).toBe(expected);
  });

  it('сохраняет fallback для неизвестной ошибки', () => {
    expect(getProjectErrorMessage(new Error('network'), 'Ошибка проекта')).toBe('Ошибка проекта');
  });
});
