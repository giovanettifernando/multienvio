import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/wallet/statement/download/route';
import { prisma } from '@/platform/db/db';
import * as sessionModule from '@/modules/auth/application/session';
import * as statementPdf from '@/shared/utils/statement-pdf';
import { apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const original = { user: prisma.user, wallet: prisma.wallet, walletTransaction: prisma.walletTransaction };
const baixar = (qs = '') => callRoute(GET as any, apiRequest(`/api/wallet/statement/download${qs}`));

function banco(carteira: Record<string, unknown> | null = { id: 'w1' }) {
  const consulta: { where?: any } = {};
  prisma.user = { findUnique: async () => ({ id: 'u1', name: 'Cliente', email: 'c@x.com' }) } as any;
  prisma.wallet = { findUnique: async () => carteira } as any;
  prisma.walletTransaction = { findMany: async (a: any) => { consulta.where = a.where; return []; } } as any;
  return consulta;
}

test.describe('app/api/wallet/statement/download', () => {
  test.beforeEach(() => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    test.mock.method(statementPdf, 'generateStatementPdf', async () => Buffer.from('%PDF-1.7'));
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, original);
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await readApi(await baixar());
    assert.strictEqual(res.status, 401);
  });

  test('responde 404 sem carteira', async () => {
    banco(null);
    const res = await readApi(await baixar());
    assert.strictEqual(res.status, 404);
  });

  test('devolve o PDF do período pedido, só com lançamentos confirmados da carteira', async () => {
    const consulta = banco();

    const res = await baixar('?dateFrom=2026-01-01&dateTo=2026-01-31&search=ME1');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition') ?? '', /^attachment; filename="extrato-carteira-.*\.pdf"$/);
    assert.strictEqual(Buffer.from(await res.arrayBuffer()).toString(), '%PDF-1.7');
    assert.strictEqual(consulta.where.walletId, 'w1');
    assert.strictEqual(consulta.where.status, 'CONFIRMED');
    assert.strictEqual(consulta.where.OR[0].title.contains, 'ME1');
  });
});
