import { describe, expect, it } from 'vitest';
import { unwrapSingleRelation } from './supabaseRelations';

describe('unwrapSingleRelation', () => {
  it('возвращает объект many-to-one relation', () => {
    expect(unwrapSingleRelation({ id: 'one' })).toEqual({ id: 'one' });
  });

  it('нормализует массив PostgREST до первого объекта', () => {
    expect(unwrapSingleRelation([{ id: 'one' }])).toEqual({ id: 'one' });
  });

  it('возвращает null для отсутствующей relation', () => {
    expect(unwrapSingleRelation([])).toBeNull();
    expect(unwrapSingleRelation(null)).toBeNull();
  });
});
