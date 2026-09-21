import assert from 'node:assert';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { POST } from '@/app/api/auth/login/route';
import { prisma } from '@/platform/db/db';
import { sessionCache } from '@/platform/cache/cache';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import * as jwt from '@/modules/auth/application/jwt-tokens';
import { UserStatus } from '@/shared/types/contracts';
import { apiRequest, callRoute } from '../../../../../_setup/test-helpers';

const originalPrismaUser = prisma.user;

const credenciais = { email: 'a@b.com', password: 'secret123' };

async function usuario(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'User',
    phone: null,
    avatarUrl: null,
    passwordHash: await bcrypt.hash('secret123', 4),
    emailVerified: true,
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function login(body: unknown, headers: Record<string, string> = {}) {
  return callRoute(POST as any, apiRequest('/api/auth/login', { json: body, headers }));
}

test.describe('app/api/auth/login', () => {
  test.beforeEach(() => {
    // Redis e JWT ficam fora: o que se testa aqui é a regra de acesso
    test.mock.method(rateLimit, 'rateLimitByIPStrict', async () => null);
    test.mock.method(sessionCache, 'getOrInitTokenVersion', async () => 1);
    test.mock.method(sessionCache, 'set', async () => true);
    test.mock.method(jwt, 'signTokenPair', async () => ({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' }));
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalPrismaUser;
  });

  test('bloqueia pedido vindo de outro site (CSRF)', async () => {
    let consultou = false;
    prisma.user = { findUnique: async () => { consultou = true; return null; } } as any;

    const res = await login(credenciais, { origin: 'https://site-malicioso.com', host: 'test' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(consultou, false, 'nem deveria chegar ao banco');
  });

  test('responde 429 quando o limite de tentativas estoura', async () => {
    test.mock.method(rateLimit, 'rateLimitByIPStrict', async () =>
      Response.json({ message: 'Muitas tentativas' }, { status: 429 })
    );
    const res = await login(credenciais);
    assert.strictEqual(res.status, 429);
  });

  test('responde 422 para dados inválidos', async () => {
    const res = await login({ email: 'nao-e-email', password: '1' });
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(body.errors.some((e: any) => e.field === 'email'));
  });

  test('usuário inexistente e senha errada dão a mesma resposta (não revela quem tem conta)', async () => {
    prisma.user = { findUnique: async () => null } as any;
    const inexistente = await login(credenciais);

    const u = await usuario();
    prisma.user = { findUnique: async () => u } as any;
    const senhaErrada = await login({ ...credenciais, password: 'errada123' });

    assert.strictEqual(inexistente.status, 401);
    assert.strictEqual(senhaErrada.status, 401);
    assert.deepStrictEqual(await inexistente.json(), await senhaErrada.json());
  });

  test('recusa e-mail ainda não verificado', async () => {
    const u = await usuario({ emailVerified: false });
    prisma.user = { findUnique: async () => u } as any;

    const res = await login(credenciais);

    assert.strictEqual(res.status, 403);
    assert.strictEqual((await res.json()).code, 'EMAIL_NOT_VERIFIED');
  });

  test('recusa conta bloqueada', async () => {
    const u = await usuario({ status: UserStatus.BLOCKED });
    prisma.user = { findUnique: async () => u } as any;
    const res = await login(credenciais);
    assert.strictEqual(res.status, 403);
  });

  test('login válido grava cookies protegidos, registra a sessão e não expõe o hash', async () => {
    const u = await usuario();
    let ultimoLogin: any;
    prisma.user = {
      findUnique: async () => u,
      update: async (args: any) => { ultimoLogin = args.data.lastLoginAt; return u; },
    } as any;

    const res = await login(credenciais);

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.id, 'u1');
    assert.strictEqual(body.user.passwordHash, undefined, 'hash da senha nunca sai na resposta');
    assert.ok(ultimoLogin instanceof Date, 'deveria registrar o último login');

    const cookies = res.headers.getSetCookie();
    const access = cookies.find((c) => c.startsWith(`${jwt.ACCESS_TOKEN_COOKIE}=`));
    const refresh = cookies.find((c) => c.startsWith(`${jwt.REFRESH_TOKEN_COOKIE}=`));
    assert.ok(access && /HttpOnly/i.test(access), 'cookie de acesso deveria ser HttpOnly');
    assert.ok(refresh && /HttpOnly/i.test(refresh), 'cookie de refresh deveria ser HttpOnly');
    assert.match(access!, /SameSite=lax/i);

    const sessao = (sessionCache.set as any).mock.calls[0].arguments;
    assert.strictEqual(sessao[0], 'u1');
    assert.strictEqual(sessao[1].tokenVersion, 1);
  });
  test('aceita e-mail colado com espaços e maiúsculas', async () => {
    const u = await usuario();
    let emailBuscado = '';
    prisma.user = {
      findUnique: async (a: any) => { emailBuscado = a.where.email; return u; },
      update: async () => u,
    } as any;

    const res = await login({ email: '  A@B.com ', password: 'secret123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(emailBuscado, 'a@b.com');
  });
});
