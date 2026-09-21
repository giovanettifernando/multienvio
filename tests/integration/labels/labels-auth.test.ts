import assert from 'node:assert';
import { describe, it, afterEach, mock } from 'node:test';
import { GET as listLabels } from '@/app/api/labels/route';
import * as sessionModule from '@/modules/auth/application/session';
import { apiRequest, callRoute } from '../../_setup/test-helpers';

afterEach(() => mock.restoreAll());

describe('/api/labels', () => {
  it('retorna 401 quando não autenticado', async () => {
    mock.method(sessionModule, 'getUserFromRequest', async () => null);
    mock.method(sessionModule, 'getSession', async () => null);
    const res = await callRoute(listLabels as any, apiRequest('/api/labels'));
    assert.strictEqual(res.status, 401);
  });
});
