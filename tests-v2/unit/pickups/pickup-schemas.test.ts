import { describe, it } from 'node:test';
import { pickupPointSchema, filtersSchema } from '../../../lib/pickup/schemas.ts';
import assert from 'node:assert/strict';

describe('pickup schemas', () => {
  it('aceita configuração válida de pickup point com PIX', () => {
    const parsed = pickupPointSchema.parse({
      razaoSocial: 'Empresa X',
      nomeFantasia: 'Loja X',
      cnpj: '12.345.678/0001-90',
      paymentMethod: { kind: 'pix', pixType: 'email', pixKey: 'contato@x.com' },
      cep: '01001-000',
      cidade: 'São Paulo',
      uf: 'SP',
    });
    assert.strictEqual(parsed.paymentMethod.kind, 'pix');
  });

  it('rejeita CEP sem cidade', () => {
    let error: unknown;
    try {
      pickupPointSchema.parse({
        razaoSocial: 'Empresa',
        nomeFantasia: 'Fantasia',
        cnpj: '12.345.678/0001-90',
        paymentMethod: { kind: 'transfer', bankCode: '237', branch: '0001', account: '12345-6', accountType: 'corrente', holderName: 'Empresa', holderDocument: '12.345.678/0001-90' },
        cep: '01001-000',
        uf: 'SP',
      });
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof Error);
  });

  it('normaliza filtros com defaults', () => {
    const parsed = filtersSchema.parse({});
    assert.strictEqual(parsed.page, 1);
    assert.strictEqual(parsed.pageSize, 10);
    assert.strictEqual(parsed.sort, 'updated_desc');
  });
});
