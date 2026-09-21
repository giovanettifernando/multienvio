import { POST } from '@/app/api/admin/finance/ledger/reconcile/route';
import { contratoFinanceiro, ok } from '../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/ledger/reconcile',
  handler: POST,
  url: '/api/admin/finance/ledger/reconcile',
  corpo: { ids: ['l1', 'l2'] },
  corpoInvalido: { ids: [] },
  limitada: true,
  sucesso: ok,
});
