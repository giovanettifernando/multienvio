import { describe, it, strictEqual, deepStrictEqual, before } from 'node:test';
import { loadLocalLabels, saveLocalLabels, pushLocalLabel, uniqueById } from '@/lib/labels/cache';

const memoryStorage: Record<string, string> = {};

before(() => {
  // Simular localStorage no ambiente de teste
  // @ts-ignore
  global.window = {
    localStorage: {
      getItem: (key: string) => memoryStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage[key] = value;
      },
    },
  };
});

describe('labels cache utilities', () => {
  it('persiste labels no localStorage simulado', () => {
    saveLocalLabels([{ id: '1', carrier: 'A', service: 'S', status: 'pending', price: 10, currency: 'BRL', trackingCode: 'T1', isPrinted: false, createdAt: '', updatedAt: '', shipmentId: 'shp-1', destinationCep: '', originCep: '', recipient: { name: 'X' } } as any]);
    const labels = loadLocalLabels();
    strictEqual(labels.length, 1);
    strictEqual(labels[0].id, '1');
  });

  it('atualiza label existente com pushLocalLabel', () => {
    pushLocalLabel({ id: '1', carrier: 'B', service: 'S', status: 'issued', price: 12, currency: 'BRL', trackingCode: 'T1', isPrinted: false, createdAt: '', updatedAt: '', shipmentId: 'shp-1', destinationCep: '', originCep: '', recipient: { name: 'X' } } as any);
    const labels = loadLocalLabels();
    strictEqual(labels[0].carrier, 'B');
  });

  it('uniqueById remove duplicados preservando ordem', () => {
    const res = uniqueById([{ id: '1' } as any, { id: '1' } as any, { id: '2' } as any]);
    deepStrictEqual(res.map((l) => l.id), ['1', '2']);
  });
});
