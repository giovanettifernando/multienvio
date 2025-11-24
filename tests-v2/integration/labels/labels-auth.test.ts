import { describe, it, strictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { GET as listLabels } from '@/app/api/labels/route';
import * as userSession from '@/lib/auth/user-session';

afterEach(() => mock.restoreAll());

describe('/api/labels', () => {
  it('retorna 401 quando não autenticado', async () => {
    mock.method(userSession, 'getUserSessionFromRequest', async () => null);
    const res = await listLabels(new Request('http://test/api/labels') as any);
    strictEqual(res.status, 401);
  });
});
