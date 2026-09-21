import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/admin/payment-transactions/pending/route';
import { prisma } from '@/platform/db/db';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalPaymentTransaction = prisma.paymentTransaction;
const listar = () => callRoute(GET, apiRequest('/api/admin/payment-transactions/pending'));

test.describe('app/api/admin/payment-transactions/pending', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.paymentTransaction = originalPaymentTransaction;
  });

  test('exige a permissão INTEGRACOES', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['FINANCEIRO'] })
    );
    const res = await readApi(await listar());
    assert.strictEqual(res.status, 403);
  });

  test('lista só pendentes, mais recentes primeiro, até 100', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['INTEGRACOES'] })
    );
    let consulta: any;
    prisma.paymentTransaction = {
      findMany: async (a: any) => { consulta = a; return [{ id: 't1' }, { id: 't2' }]; },
    } as any;

    const res = await readApi(await listar());

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(consulta.where, { status: 'PENDING' });
    assert.deepStrictEqual(consulta.orderBy, { createdAt: 'desc' });
    assert.strictEqual(consulta.take, 100);
    assert.deepStrictEqual(consulta.include.user.select, { name: true, email: true });
    assert.strictEqual(res.data.total, 2);
  });
});
