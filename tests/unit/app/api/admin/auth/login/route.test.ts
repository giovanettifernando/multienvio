import assert from 'node:assert';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { AdminPermission } from '@prisma/client';
import { POST } from '@/app/api/admin/auth/login/route';
import { prisma } from '@/platform/db/db';
import { staffSessionCache } from '@/platform/cache/cache';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import * as adminSession from '@/modules/auth/application/admin-session';
import * as audit from '@/platform/logging/audit-admin';
import { apiRequest, callRoute } from '../../../../../../_setup/test-helpers';

const originalStaffUser = prisma.staffUser;
const credenciais = { email: 'Staff@Empresa.com', password: 'admin123' };

async function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    name: 'Staff',
    email: 'staff@empresa.com',
    passwordHash: await bcrypt.hash('admin123', 4),
    status: 'ACTIVE',
    isSuperAdmin: false,
    permissions: ['OPERACOES'],
    role: { name: 'operator' },
    lastLoginAt: null,
    lastAccessAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function login(body: unknown, headers: Record<string, string> = {}) {
  return callRoute(POST as any, apiRequest('/api/admin/auth/login', { json: body, headers }));
}

test.describe('app/api/admin/auth/login', () => {
  test.beforeEach(() => {
    test.mock.method(rateLimit, 'rateLimitByIPStrict', async () => null);
    test.mock.method(staffSessionCache, 'getOrInitTokenVersion', async () => 3);
    test.mock.method(staffSessionCache, 'set', async () => true);
    test.mock.method(adminSession, 'adminSign', async () => 'admin.jwt');
    test.mock.method(audit, 'logAdminLogin', async () => {});
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaffUser;
  });

  test('bloqueia pedido vindo de outro site (CSRF)', async () => {
    const res = await login(credenciais, { origin: 'https://site-malicioso.com', host: 'test' });
    assert.strictEqual(res.status, 403);
  });

  test('busca pelo e-mail normalizado e dá a mesma resposta para quem não existe e senha errada', async () => {
    let emailBuscado = '';
    prisma.staffUser = { findUnique: async (a: any) => { emailBuscado = a.where.email; return null; } } as any;
    const inexistente = await login(credenciais);

    const s = await staff();
    prisma.staffUser = { findUnique: async () => s } as any;
    const senhaErrada = await login({ ...credenciais, password: 'errada123' });

    assert.strictEqual(emailBuscado, 'staff@empresa.com');
    assert.strictEqual(inexistente.status, 401);
    assert.strictEqual(senhaErrada.status, 401);
    assert.deepStrictEqual(await inexistente.json(), await senhaErrada.json());
  });

  test('recusa staff inativo', async () => {
    const s = await staff({ status: 'BLOCKED' });
    prisma.staffUser = { findUnique: async () => s } as any;
    const res = await login(credenciais);
    assert.strictEqual(res.status, 403);
  });

  test('login válido: cookie HttpOnly, sessão registrada, auditoria e permissões do próprio staff', async () => {
    const s = await staff();
    prisma.staffUser = { findUnique: async () => s, update: async () => s } as any;

    const res = await login(credenciais);

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.staff.permissions, ['OPERACOES']);
    assert.strictEqual(body.staff.passwordHash, undefined);

    const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${adminSession.ADMIN_AUTH_COOKIE_NAME}=`));
    assert.ok(cookie && /HttpOnly/i.test(cookie));

    const assinatura = (adminSession.adminSign as any).mock.calls[0].arguments[0];
    assert.deepStrictEqual(assinatura.permissions, ['OPERACOES']);
    assert.strictEqual(assinatura.tokenVersion, 3);
    assert.strictEqual((audit.logAdminLogin as any).mock.callCount(), 1);
  });

  test('super admin recebe todas as permissões', async () => {
    const s = await staff({ isSuperAdmin: true, permissions: [] });
    prisma.staffUser = { findUnique: async () => s, update: async () => s } as any;

    const res = await login(credenciais);

    const body = await res.json();
    assert.deepStrictEqual([...body.staff.permissions].sort(), Object.values(AdminPermission).sort());
  });

  test('falha na auditoria não impede o login', async () => {
    test.mock.method(audit, 'logAdminLogin', async () => {
      throw new Error('auditoria fora do ar');
    });
    const s = await staff();
    prisma.staffUser = { findUnique: async () => s, update: async () => s } as any;

    const res = await login(credenciais);

    assert.strictEqual(res.status, 200);
  });
  test('aceita e-mail colado com espaços', async () => {
    const s = await staff();
    let emailBuscado = '';
    prisma.staffUser = {
      findUnique: async (a: any) => { emailBuscado = a.where.email; return s; },
      update: async () => s,
    } as any;

    const res = await login({ ...credenciais, email: ' Staff@Empresa.com  ' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(emailBuscado, 'staff@empresa.com');
  });
});
