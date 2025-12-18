import assert from 'node:assert';
import test from 'node:test';
import { cn } from '@/shared/utils/cn';

test('utils/cn concatena classes ignorando falsy', () => {
  assert.strictEqual(cn('a', '', null, 'b', false, undefined, 'c'), 'a b c');
  assert.strictEqual(cn(), '');
});
