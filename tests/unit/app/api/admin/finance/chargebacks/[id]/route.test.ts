import { POST } from '@/app/api/admin/finance/chargebacks/[id]/route';
import { contratoFinanceiro, ok } from '../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/chargebacks/[id]',
  handler: POST,
  url: '/api/admin/finance/chargebacks/x1',
  params: { id: 'x1' },
  corpo: { status: 'won', notes: 'contestação aceita' },
  corpoInvalido: { status: 'approved' },
  limitada: true,
  sucesso: ok,
});
