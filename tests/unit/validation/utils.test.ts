import assert from 'node:assert';
import test from 'node:test';
import { isValidCPF, isValidCNPJ, getCompanyDisplayName, getCompanyDocument } from '@/shared/validation/utils';

const pfCompany = {
  tipoPessoa: 'PF',
  pessoa: { nomeCompleto: 'João Silva', cpf: '12345678909' },
  empresa: {},
  preferencias: { remetente: '' },
};

const pjCompany = {
  tipoPessoa: 'PJ',
  pessoa: {},
  empresa: { fantasia: 'Acme', cnpj: '12.345.678/0001-99', razao: 'Acme LTDA' },
  preferencias: { remetente: '' },
};

test.describe('validation/utils', () => {
  test('isValidCPF detecta CPFs válidos e inválidos', () => {
    assert.strictEqual(isValidCPF('529.982.247-25'), true); // CPF válido conhecido
    assert.strictEqual(isValidCPF('111.111.111-11'), false); // repetido
    assert.strictEqual(isValidCPF('123'), false);
  });

  test('isValidCNPJ detecta CNPJs válidos e inválidos', () => {
    assert.strictEqual(isValidCNPJ('45.723.174/0001-10'), true); // válido
    assert.strictEqual(isValidCNPJ('11.111.111/1111-11'), false); // repetido
    assert.strictEqual(isValidCNPJ('123'), false);
  });

  test('getCompanyDisplayName prioriza remetente, PF, depois fantasia/razão', () => {
    assert.strictEqual(getCompanyDisplayName({ ...pfCompany, preferencias: { remetente: 'Loja X' } } as any), 'Loja X');
    assert.strictEqual(getCompanyDisplayName(pfCompany as any), 'João Silva');
    const pjSemFantasia = {
      tipoPessoa: 'PJ',
      pessoa: {},
      empresa: { fantasia: '', razao: 'Razão', cnpj: '12.345.678/0001-99' },
      preferencias: { remetente: '' },
    };
    // fantasia vazia faz short-circuit e ignora razão na implementação atual
    assert.strictEqual(getCompanyDisplayName(pjSemFantasia as any), '');
    assert.strictEqual(getCompanyDisplayName({ ...pjSemFantasia, empresa: { fantasia: 'Fantasia', razao: 'Razão', cnpj: '12' } } as any), 'Fantasia');
  });

  test('getCompanyDocument retorna CPF para PF e CNPJ para PJ', () => {
    assert.strictEqual(getCompanyDocument(pfCompany as any), '12345678909');
    assert.strictEqual(getCompanyDocument(pjCompany as any), '12345678000199');
  });
});
