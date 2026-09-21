import assert from 'node:assert';
import crypto from 'node:crypto';
import test from 'node:test';
import { POST } from '@/app/api/admin/clients/reset-password/route';
import { prisma } from '@/platform/db/db';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as mailer from '@/platform/email/mailer';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalUser = prisma.user;
const originalToken = prisma.passwordResetToken;

const resetar = (body: unknown) =>
  callRoute(POST, apiRequest('/api/admin/clients/reset-password', { json: body }));

test.describe('app/api/admin/clients/reset-password', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
    prisma.passwordResetToken = originalToken;
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await readApi(await resetar({ ids: ['c1'] }));
    assert.strictEqual(res.status, 401);
  });

  test('responde 403 sem a permissão CONTAS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['FINANCEIRO'] })
    );
    const res = await readApi(await resetar({ ids: ['c1'] }));
    assert.strictEqual(res.status, 403);
  });

  test('responde 400 sem ids', async () => {
    const res = await readApi(await resetar({ ids: [] }));
    assert.strictEqual(res.status, 400);
  });

  test('responde 404 quando nenhum id existe', async () => {
    prisma.user = { findMany: async () => [] } as any;
    const res = await readApi(await resetar({ ids: ['x'] }));
    assert.strictEqual(res.status, 404);
  });

  test('grava só o hash do token e manda o link com o token original', async () => {
    prisma.user = {
      findMany: async () => [{ id: 'c1', name: 'Cliente', email: 'c@x.com' }],
    } as any;
    let hashGravado = '';
    prisma.passwordResetToken = {
      create: async (a: any) => { hashGravado = a.data.tokenHash; return {}; },
    } as any;
    test.mock.method(mailer, 'sendPasswordResetEmail', async () => true);

    const res = await readApi(await resetar({ ids: ['c1'] }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data.results, [{ email: 'c@x.com', success: true }]);
    const link = (mailer.sendPasswordResetEmail as any).mock.calls[0].arguments[2] as string;
    const token = new URL(link).searchParams.get('token') ?? '';
    assert.ok(token.length > 0);
    assert.notStrictEqual(hashGravado, token, 'o token em claro não pode ir para o banco');
    assert.strictEqual(hashGravado, crypto.createHash('sha256').update(token).digest('hex'));
  });

  test('falha no envio de um e-mail não derruba os outros', async () => {
    prisma.user = {
      findMany: async () => [
        { id: 'c1', name: 'Um', email: 'um@x.com' },
        { id: 'c2', name: 'Dois', email: 'dois@x.com' },
      ],
    } as any;
    prisma.passwordResetToken = { create: async () => ({}) } as any;
    test.mock.method(mailer, 'sendPasswordResetEmail', async (email: string) => {
      if (email === 'um@x.com') throw new Error('smtp fora');
      return true;
    });

    const res = await readApi(await resetar({ ids: ['c1', 'c2'] }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data.results, [
      { email: 'um@x.com', success: false },
      { email: 'dois@x.com', success: true },
    ]);
    assert.match(res.data.message, /1 de 2/);
  });
});
