import { POST } from '@/app/api/admin/finance/commissions/[id]/approve/route';
import { contratoFinanceiro, ok } from '../../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/commissions/[id]/approve',
  handler: POST,
  url: '/api/admin/finance/commissions/x1/approve',
  params: { id: 'x1' },
  corpo: {},
  limitada: true,
  sucesso: ok,
});
