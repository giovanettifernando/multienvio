import assert from 'node:assert';
import test from 'node:test';
import { POST } from '../../../../../../app/api/account/password/route.ts';
import { ApiError } from '../../../../../../lib/api/errors.ts';

function makeRequest(body: any) {
  return new Request('http://test/api/account/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('app/api/account/password', () => {
  let sessionModule: any;
  let rateLimitModule: any;
  let schemaModule: any;
  let securityModule: any;
  let mailerModule: any;
  let dbModule: any;
  let originalUserDelegate: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../lib/auth/session.ts');
    rateLimitModule = await import('../../../../../../lib/api/rate-limit.ts');
    schemaModule = await import('../../../../../../lib/validation/password-policy.ts');
    securityModule = await import('../../../../../../lib/services/account-security.service.ts');
    mailerModule = await import('../../../../../../lib/email/mailer.ts');
    dbModule = await import('../../../../../../lib/db.ts');
    originalUserDelegate = dbModule.default.user;
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    dbModule.default.user = originalUserDelegate;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'unauthorized');
  });

  test('retorna 429 ao exceder limite', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(rateLimitModule, 'enforceRateLimit', () => {
      throw new ApiError({ code: 'rate_limit_exceeded', message: 'too many', status: 429 });
    });
    test.mock.method(schemaModule.changePasswordSchema, 'safeParse', () => ({ success: true, data: { currentPassword: 'a', newPassword: 'b', confirmPassword: 'b' } }));
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 429);
    const body = await res.json();
    assert.strictEqual(body.code, 'too_many_attempts');
  });

  test('retorna 400 em payload inválido', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(rateLimitModule, 'enforceRateLimit', () => {});
    test.mock.method(schemaModule.changePasswordSchema, 'safeParse', () => ({
      success: false,
      error: { issues: [{ path: ['currentPassword'], message: 'Obrigatório', code: 'custom' }] },
    }));
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'invalid_payload');
  });

  test('altera senha com sucesso', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(rateLimitModule, 'enforceRateLimit', () => {});
    test.mock.method(schemaModule.changePasswordSchema, 'safeParse', () => ({
      success: true,
      data: { currentPassword: 'old', newPassword: 'newPass1!', confirmPassword: 'newPass1!' },
    }));
    test.mock.method(securityModule.accountSecurityService, 'changePassword', async () => ({
      success: true,
      sessionInvalidated: true,
      passwordUpdatedAt: new Date('2024-01-01'),
    }));
    dbModule.default.user = { findUnique: async () => ({ email: 'a@b.com', name: 'User' }) } as any;
    test.mock.method(mailerModule, 'sendPasswordChangedEmail', async () => {});
    test.mock.method(sessionModule, 'removeAuthCookie', async () => {});

    const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'newPass1!' }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.requireReauth, true);
  });
});
