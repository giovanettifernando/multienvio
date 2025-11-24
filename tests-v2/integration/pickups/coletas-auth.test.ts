import { describe, it, strictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { GET as listPickups } from '@/app/api/coletas/route';
import * as userSession from '@/lib/auth/user-session';

afterEach(() => mock.restoreAll());

describe('/api/coletas', () => {
  it('retorna 401 sem usuário', async () => {
    mock.method(userSession, 'getUserSessionFromRequest', async () => null);
    const req = new Request('http://test/api/coletas');
    const res = await listPickups(req as any);
    strictEqual(res.status, 401);
  });
});
