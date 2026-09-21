import assert from 'node:assert';
import { describe, it, afterEach, mock } from 'node:test';
import { POST as createQuoteRoute } from '@/app/api/cotacoes/route';
import * as sessionModule from '@/modules/auth/application/session';
import { apiRequest, callRoute } from '../../_setup/test-helpers';

afterEach(() => mock.restoreAll());

describe('/api/cotacoes - auth', () => {
  it('retorna 401 quando usuário não está autenticado', async () => {
    mock.method(sessionModule, 'getUserFromRequest', async () => null);
    mock.method(sessionModule, 'getSession', async () => null);
    const res = await callRoute(createQuoteRoute as any, apiRequest('/api/cotacoes', { json: {} }));
    assert.strictEqual(res.status, 401);
  });
});
