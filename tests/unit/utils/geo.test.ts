import assert from 'node:assert';
import test from 'node:test';
import { calculateDistance, getUFCoordinates, formatDistance, CAPITAL_COORDINATES } from '@/shared/utils/geo';

test.describe('utils/geo', () => {
  test('calculateDistance usa Haversine e arredonda para 1 casa', () => {
    const sp = { lat: -23.5505, lng: -46.6333 };
    const rj = { lat: -22.9068, lng: -43.1729 };
    const dist = calculateDistance(sp, rj);
    assert.strictEqual(typeof dist, 'number');
    assert.ok(dist > 300 && dist < 500); // ~360km
  });

  test('getUFCoordinates retorna coordenadas conhecidas', () => {
    assert.deepStrictEqual(getUFCoordinates('sp'), CAPITAL_COORDINATES.SP);
    assert.strictEqual(getUFCoordinates('xx'), undefined);
  });

  test('formatDistance formata valores, menor que 1 e nulos', () => {
    assert.strictEqual(formatDistance(10.123), '10.1 km');
    assert.strictEqual(formatDistance(0.5), '< 1 km');
    assert.strictEqual(formatDistance(undefined), '—');
  });
});
