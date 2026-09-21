import { POST } from '@/app/api/admin/finance/commissions/[id]/paid/route';
import { contratoFinanceiro, ok } from '../../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/commissions/[id]/paid',
  handler: POST,
  url: '/api/admin/finance/commissions/x1/paid',
  params: { id: 'x1' },
  corpo: {},
  limitada: true,
  sucesso: ok,
});
