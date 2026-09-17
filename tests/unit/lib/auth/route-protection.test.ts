import assert from 'node:assert/strict';
import test from 'node:test';

import { getRouteProtection } from '@/modules/auth/application/route-protection';

test.describe('lib/auth/route-protection', () => {
  test.describe('public routes (no auth required)', () => {
    test('home page is public', () => {
      assert.equal(getRouteProtection('/'), null);
    });

    test('auth pages are public', () => {
      assert.equal(getRouteProtection('/auth/login'), null);
      assert.equal(getRouteProtection('/auth/register'), null);
      assert.equal(getRouteProtection('/auth/forgot-password'), null);
    });

    test('auth API endpoints are public', () => {
      assert.equal(getRouteProtection('/api/auth/login'), null);
      assert.equal(getRouteProtection('/api/auth/register'), null);
      assert.equal(getRouteProtection('/api/auth/me'), null);
    });

    test('admin auth API endpoints are public', () => {
      assert.equal(getRouteProtection('/api/admin/auth/login'), null);
      assert.equal(getRouteProtection('/api/admin/auth/logout'), null);
    });

    test('health check endpoints are public', () => {
      assert.equal(getRouteProtection('/api/health'), null);
      assert.equal(getRouteProtection('/api/health/db'), null);
    });

    test('public API endpoints are public', () => {
      assert.equal(getRouteProtection('/api/public/track/ABC123'), null);
    });

    test('webhooks are public (external services)', () => {
      assert.equal(getRouteProtection('/api/webhooks/pagarme'), null);
      assert.equal(getRouteProtection('/api/webhooks/tracking'), null);
      assert.equal(getRouteProtection('/api/webhooks/pix'), null);
    });

    test('CEP lookup is public', () => {
      assert.equal(getRouteProtection('/api/cep/01310100'), null);
    });

    test('system status is public', () => {
      assert.equal(getRouteProtection('/api/system/status'), null);
    });
  });

  test.describe('admin routes (staff authentication)', () => {
    test('admin pages require admin auth', () => {
      assert.equal(getRouteProtection('/admin'), 'admin');
      assert.equal(getRouteProtection('/admin/users'), 'admin');
      assert.equal(getRouteProtection('/admin/settings'), 'admin');
    });

    test('admin API endpoints require admin auth', () => {
      assert.equal(getRouteProtection('/api/admin/clients'), 'admin');
      assert.equal(getRouteProtection('/api/admin/finance/summary'), 'admin');
    });
  });

  test.describe('authenticated routes (user login required)', () => {
    test('user pages require auth', () => {
      assert.equal(getRouteProtection('/conta'), 'auth');
      assert.equal(getRouteProtection('/minha-conta'), 'auth');
      assert.equal(getRouteProtection('/envios'), 'auth');
    });

    test('wallet API requires auth', () => {
      assert.equal(getRouteProtection('/api/wallet'), 'auth');
      assert.equal(getRouteProtection('/api/wallet/transactions'), 'auth');
    });

    test('shipments API requires auth', () => {
      assert.equal(getRouteProtection('/api/shipments'), 'auth');
      assert.equal(getRouteProtection('/api/shipments/123'), 'auth');
    });

    test('cart API requires auth', () => {
      assert.equal(getRouteProtection('/api/cart'), 'auth');
      assert.equal(getRouteProtection('/api/carrinho'), 'auth');
    });

    test('payments API requires auth', () => {
      assert.equal(getRouteProtection('/api/payments/charge'), 'auth');
      assert.equal(getRouteProtection('/api/payments/pagarme/create'), 'auth');
    });

    test('account API requires auth', () => {
      assert.equal(getRouteProtection('/api/account/profile'), 'auth');
      assert.equal(getRouteProtection('/api/account/cards'), 'auth');
    });
  });

  test.describe('default behavior (deny by default for APIs)', () => {
    test('unknown API routes require auth by default', () => {
      // Suppress console.warn for this test
      const originalWarn = console.warn;
      console.warn = () => {};

      assert.equal(getRouteProtection('/api/unknown-endpoint'), 'auth');
      assert.equal(getRouteProtection('/api/some/random/path'), 'auth');

      console.warn = originalWarn;
    });

    test('unknown page routes are public by default', () => {
      // Non-API routes that aren't explicitly protected are public
      assert.equal(getRouteProtection('/some-public-page'), null);
      assert.equal(getRouteProtection('/landing'), null);
    });
  });
});
