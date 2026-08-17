import { describe, expect, it } from 'vitest';
import { isMissingRpcFunction } from './rpcFallback';

describe('isMissingRpcFunction', () => {
  it('распознаёт отсутствующую RPC по коду PostgREST', () => {
    expect(isMissingRpcFunction({ code: 'PGRST202', message: 'not found' })).toBe(true);
  });

  it('распознаёт устаревший schema cache по сообщению', () => {
    expect(isMissingRpcFunction({ message: 'Could not find the function in the schema cache' }))
      .toBe(true);
  });

  it('не скрывает прикладную ошибку RPC', () => {
    expect(isMissingRpcFunction({ code: 'P0001', message: 'INVENTORY_ACTIVE_ASSIGNMENT_EXISTS' }))
      .toBe(false);
  });
});
