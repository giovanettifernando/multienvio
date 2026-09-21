import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/admin/finance/reports/route';
import { contratoFinanceiro, comoFinanceiro, chamar } from '../_contrato';

// Atenção: o CSV desta rota ainda sai com números fixos herdados do Envio Legal
// (o DRE real está em /reports/dre). Nenhuma tela montada chama esta rota.
const rota = {
  nome: 'app/api/admin/finance/reports',
  handler: GET as any,
  url: '/api/admin/finance/reports?report=taxes&dateStart=2026-01-01&dateEnd=2026-01-31',
};

contratoFinanceiro(rota);

test.describe('app/api/admin/finance/reports (CSV)', () => {
  test.afterEach(() => test.mock.restoreAll());

  test('devolve CSV para download com o período no cabeçalho', async () => {
    comoFinanceiro();
    const res = await chamar(rota);
    assert.strictEqual(res.headers.get('content-type'), 'text/csv');
    assert.match(res.headers.get('content-disposition') ?? '', /^attachment; filename="relatorio-taxes-\d+\.csv"$/);
    const csv = await res.text();
    assert.match(csv.split('\n')[0], /Período: 2026-01-01 a 2026-01-31/);
  });
});
