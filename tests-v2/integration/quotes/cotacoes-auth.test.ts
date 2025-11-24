import { describe, it, strictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { POST as createQuoteRoute } from '@/app/api/cotacoes/route';
import * as userSession from '@/lib/auth/user-session';

afterEach(() => mock.restoreAll());

describe('/api/cotacoes - auth', () => {
  it('retorna 401 quando usuário não está autenticado', async () => {
    mock.method(userSession, 'getUserSessionFromRequest', async () => null);
    const req = new Request('http://test/api/cotacoes', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await createQuoteRoute(req);
    strictEqual(res.status, 401);
  });
});
