import { POST } from '@/app/api/admin/finance/reconciliation/mark/route';
import { contratoFinanceiro, ok } from '../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/reconciliation/mark',
  handler: POST,
  url: '/api/admin/finance/reconciliation/mark',
  corpo: { ids: ['l1', 'l2'] },
  corpoInvalido: { ids: [] },
  limitada: true,
  sucesso: ok,
});
