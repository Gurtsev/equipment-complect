import { describe, expect, it } from 'vitest';
import { MAX_EQUIPMENT_IMAGE_SIZE, validateEquipmentImage } from './imageValidation';

describe('validateEquipmentImage', () => {
  it('разрешает изображение размером не более 10 МБ', () => {
    expect(validateEquipmentImage({ type: 'image/jpeg', size: MAX_EQUIPMENT_IMAGE_SIZE })).toBeNull();
  });

  it('отклоняет файл с MIME не image/*', () => {
    expect(validateEquipmentImage({ type: 'application/pdf', size: 1024 }))
      .toBe('Можно загружать только изображения');
  });

  it('отклоняет изображение больше 10 МБ', () => {
    expect(validateEquipmentImage({ type: 'image/png', size: MAX_EQUIPMENT_IMAGE_SIZE + 1 }))
      .toBe('Размер изображения не должен превышать 10 МБ');
  });
});

