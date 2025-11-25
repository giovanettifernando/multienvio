import assert from 'node:assert';
import test from 'node:test';
import { companyWizardSchema } from '../../../lib/validation/company.ts';

test.describe('validation/company', () => {
  test('valida PF com cpf válido', () => {
    const parsed = companyWizardSchema.parse({
      tipoPessoa: 'PF',
      pessoa: { nomeCompleto: 'Fulano Teste', cpf: '390.533.447-05' },
      endereco: {
        cep: '12345-678',
        logradouro: 'Rua',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Cidade',
        uf: 'SP',
      },
      preferencias: {
        remetente: 'Fulano',
        emailNotificacoes: 'a@b.com',
        aceite: true,
      },
    });
    assert.strictEqual(parsed.tipoPessoa, 'PF');
  });

  test('valida PJ com cnpj válido e rejeita se inválido', () => {
    const ok = companyWizardSchema.parse({
      tipoPessoa: 'PJ',
      empresa: { razao: 'Empresa', cnpj: '27.865.757/0001-02', regime: 'SIMPLES' },
      endereco: {
        cep: '12345-678',
        logradouro: 'Rua',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Cidade',
        uf: 'SP',
      },
      preferencias: {
        remetente: 'Fulano',
        emailNotificacoes: 'a@b.com',
        aceite: true,
      },
    });
    assert.strictEqual(ok.empresa.cnpj, '27.865.757/0001-02');

    assert.throws(() => companyWizardSchema.parse({
      tipoPessoa: 'PJ',
      empresa: { razao: 'Empresa', cnpj: '123', regime: 'SIMPLES' },
      endereco: {
        cep: '12345-678',
        logradouro: 'Rua',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Cidade',
        uf: 'SP',
      },
      preferencias: {
        remetente: 'Fulano',
        emailNotificacoes: 'a@b.com',
        aceite: true,
      },
    }));
  });
});
