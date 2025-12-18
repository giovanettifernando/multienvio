import assert from 'node:assert';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { ApiError } from '@/platform/api/errors';
import { AccountSecurityService, SecurityEventType } from '@/modules/auth/application/account-security.service';
import * as policyModule from '@/shared/validation/password-policy';
import * as cacheModule from '@/platform/cache/cache';

function makeService(overrides: any = {}) {
  const prisma: any = {
    user: {
      findUnique: async () => null,
      update: async () => ({}),
    },
    userSecurityEvent: {
      create: async () => ({}),
      findMany: async () => [],
      count: async () => 0,
    },
  };
  Object.assign(prisma, overrides.prisma);
  return new AccountSecurityService({ prisma, logger: overrides.logger });
}

test.describe('services/account-security', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('lança unauthorized quando usuário não existe', async () => {
    const service = makeService();
    await assert.rejects(
      () => service.changePassword('u1', { currentPassword: 'old', newPassword: 'new123!' }),
      ApiError,
    );
  });

  test('falha quando usuário sem hash definido', async () => {
    const service = makeService({
      prisma: {
        user: {
          findUnique: async () => ({ id: 'u1', email: 'a@b.com', passwordHash: null }),
        },
      },
    });
    await assert.rejects(
      () => service.changePassword('u1', { currentPassword: 'old', newPassword: 'new123!' }),
      (err: any) => err instanceof ApiError && err.code === 'password_not_set',
    );
  });

  test('falha quando senha atual incorreta', async () => {
    test.mock.method(bcrypt, 'compare', async () => false);
    const service = makeService({
      prisma: {
        user: {
          findUnique: async () => ({ id: 'u1', email: 'a@b.com', passwordHash: 'hash', passwordHistory: null }),
        },
      },
    });
    await assert.rejects(
      () => service.changePassword('u1', { currentPassword: 'old', newPassword: 'new123!' }),
      (err: any) => err instanceof ApiError && err.code === 'current_password_incorrect',
    );
  });

  test('falha quando política não atende', async () => {
    test.mock.method(bcrypt, 'compare', async () => true);
    test.mock.method(policyModule, 'validatePasswordPolicy', () => ({ valid: false, errors: ['weak'] }));
    const service = makeService({
      prisma: {
        user: {
          findUnique: async () => ({ id: 'u1', email: 'a@b.com', passwordHash: 'hash', passwordHistory: null }),
        },
      },
    });
    await assert.rejects(
      () => service.changePassword('u1', { currentPassword: 'old', newPassword: 'new123!' }),
      (err: any) => err instanceof ApiError && err.code === 'password_policy_failed',
    );
  });

  test('falha quando reutiliza senha', async () => {
    test.mock.method(bcrypt, 'compare', async (value) => value !== 'new123!');
    test.mock.method(policyModule, 'validatePasswordPolicy', () => ({ valid: true, errors: [] }));
    test.mock.method(policyModule, 'isPasswordReused', async () => true);
    const service = makeService({
      prisma: {
        user: {
          findUnique: async () => ({ id: 'u1', email: 'a@b.com', passwordHash: 'hash', passwordHistory: ['h1'] }),
        },
      },
    });
    await assert.rejects(
      () => service.changePassword('u1', { currentPassword: 'old', newPassword: 'new123!' }),
      (err: any) => err instanceof ApiError && err.code === 'password_reused',
    );
  });

  test('altera senha com sucesso e registra eventos', async () => {
    let compareCalls = 0;
    test.mock.method(bcrypt, 'compare', async () => {
      compareCalls += 1;
      return compareCalls === 1; // primeira comparação (senha atual) true, segunda (nova x hash atual) false
    });
    test.mock.method(policyModule, 'validatePasswordPolicy', () => ({ valid: true, errors: [] }));
    test.mock.method(policyModule, 'isPasswordReused', async () => false);
    test.mock.method(policyModule, 'updatePasswordHistory', () => ['hist']);
    test.mock.method(bcrypt, 'hash', async () => 'newHash');
    // Mock sessionCache.incrementTokenVersion
    test.mock.method(cacheModule.sessionCache, 'incrementTokenVersion', async () => 2);
    const createCalls: any[] = [];
    let updatedPayload: any;
    const service = makeService({
      prisma: {
        user: {
          findUnique: async () => ({
            id: 'u1',
            email: 'a@b.com',
            passwordHash: 'oldHash',
            passwordHistory: [],
          }),
          update: async (args: any) => {
            updatedPayload = args.data;
            return {};
          },
        },
        userSecurityEvent: {
          create: async (args: any) => {
            createCalls.push(args);
            return {};
          },
        },
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });
    const result = await service.changePassword('u1', { currentPassword: 'old', newPassword: 'new123!' }, { ip: '1.1.1.1' });
    assert.strictEqual(result.success, true);
    assert.ok(updatedPayload.passwordHash);
    assert.strictEqual(createCalls[0].data.type, SecurityEventType.PASSWORD_CHANGED);
    assert.strictEqual(result.sessionInvalidated, true);
  });

  test('getUserSecurityEvents retorna lista', async () => {
    const service = makeService({
      prisma: {
        userSecurityEvent: {
          findMany: async () => [{ id: 'e1' }],
          count: async () => 1,
        },
      },
    });
    const res = await service.getUserSecurityEvents('u1', { limit: 5, offset: 0 });
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.events[0].id, 'e1');
  });
});
