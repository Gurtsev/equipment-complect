import { describe, expect, it } from 'vitest';
import { parseInventoryDeepLink } from './deepLink';

describe('parseInventoryDeepLink', () => {
  it('нормализует ссылку на оборудование и сохраняет другие параметры', () => {
    expect(parseInventoryDeepLink('?eq=eqp-0042&source=qr')).toEqual({
      target: { type: 'equipment', value: 'EQP-0042' },
      remainingSearch: '?source=qr',
      hadInventoryParams: true,
    });
  });

  it('при двух валидных целях выбирает оборудование', () => {
    expect(parseInventoryDeepLink('?room=A-01-02&eq=EQP-1234').target)
      .toEqual({ type: 'equipment', value: 'EQP-1234' });
  });

  it('поддерживает помещение произвольной глубины', () => {
    expect(parseInventoryDeepLink('?room=c-01-09-01').target)
      .toEqual({ type: 'room', value: 'C-01-09-01' });
  });

  it('отклоняет параметры неверного формата и удаляет их из URL', () => {
    expect(parseInventoryDeepLink('?eq=../../secret&room=A-1&source=test')).toEqual({
      target: null,
      remainingSearch: '?source=test',
      hadInventoryParams: true,
    });
  });

  it('не меняет URL без inventory-параметров', () => {
    expect(parseInventoryDeepLink('?source=nexus')).toEqual({
      target: null,
      remainingSearch: '?source=nexus',
      hadInventoryParams: false,
    });
  });
});
