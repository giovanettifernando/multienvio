import assert from 'node:assert';
import test from 'node:test';
import { PasswordPolicySchema } from '../../../lib/validation/password-policy.ts';

test.describe('validation/password-policy', () => {
  test('aceita senha forte', () => {
    const parsed = PasswordPolicySchema.parse({ password: 'Strong123!' });
    assert.strictEqual(parsed.password, 'Strong123!');
  });

  test('rejeita senha curta', () => {
    assert.throws(() => PasswordPolicySchema.parse({ password: 'abc' }));
  });
});
