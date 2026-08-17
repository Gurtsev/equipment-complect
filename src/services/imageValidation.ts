export const MAX_EQUIPMENT_IMAGE_SIZE = 10 * 1024 * 1024;

export interface ImageFileMetadata {
  type: string;
  size: number;
}

export function validateEquipmentImage(file: ImageFileMetadata): string | null {
  if (!file.type.toLowerCase().startsWith('image/')) {
    return 'Можно загружать только изображения';
  }
  if (file.size > MAX_EQUIPMENT_IMAGE_SIZE) {
    return 'Размер изображения не должен превышать 10 МБ';
  }
  return null;
}

