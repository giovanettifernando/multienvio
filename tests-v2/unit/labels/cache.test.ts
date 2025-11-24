import { describe, it, beforeEach } from 'node:test';
import { loadLocalLabels, saveLocalLabels, pushLocalLabel, uniqueById } from '../../../lib/labels/cache.ts';
import assert from 'node:assert/strict';

const memoryStorage: Record<string, string> = {};

beforeEach(() => {
  // Limpar state anterior
  for (const key of Object.keys(memoryStorage)) {
    delete memoryStorage[key];
  }

  // Mock básico de localStorage em memória
  const storage: Partial<Storage> = {
    getItem: (key: string) => memoryStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage[key] = value;
      return undefined;
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    writable: true,
    configurable: true,
  });
});

describe('labels cache utilities', () => {
  it('persiste labels no localStorage simulado', () => {
    saveLocalLabels([{ id: '1', carrier: 'A', service: 'S', status: 'pending', price: 10, currency: 'BRL', trackingCode: 'T1', isPrinted: false, createdAt: '', updatedAt: '', shipmentId: 'shp-1', destinationCep: '', originCep: '', recipient: { name: 'X' } } as any]);
    const labels = loadLocalLabels();
    assert.strictEqual(labels.length, 1);
    assert.strictEqual(labels[0].id, '1');
  });

  it('atualiza label existente com pushLocalLabel', () => {
    pushLocalLabel({ id: '1', carrier: 'B', service: 'S', status: 'issued', price: 12, currency: 'BRL', trackingCode: 'T1', isPrinted: false, createdAt: '', updatedAt: '', shipmentId: 'shp-1', destinationCep: '', originCep: '', recipient: { name: 'X' } } as any);
    const labels = loadLocalLabels();
    assert.strictEqual(labels[0].carrier, 'B');
  });

  it('uniqueById remove duplicados preservando ordem', () => {
    const res = uniqueById([{ id: '1' } as any, { id: '1' } as any, { id: '2' } as any]);
    assert.deepStrictEqual(res.map((l) => l.id), ['1', '2']);
  });
});
