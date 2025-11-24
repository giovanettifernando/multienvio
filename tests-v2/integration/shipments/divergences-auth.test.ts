import { describe, it, strictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { GET as getDivergences } from '@/app/api/shipments/[id]/divergences/route';
import * as sessionModule from '@/lib/auth/session';

afterEach(() => mock.restoreAll());

describe('/api/shipments/[id]/divergences', () => {
  it('retorna 401 sem sessão', async () => {
    mock.method(sessionModule, 'getSession', async () => null);
    const res = await getDivergences(new Request('http://test/api/shipments/1/divergences'), { params: Promise.resolve({ id: '1' }) });
    strictEqual(res.status, 401);
  });
});
