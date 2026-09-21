import { POST } from '@/app/api/admin/finance/invoices/[id]/cancel/route';
import { contratoFinanceiro, ok } from '../../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/invoices/[id]/cancel',
  handler: POST,
  url: '/api/admin/finance/invoices/x1/cancel',
  params: { id: 'x1' },
  corpo: {},
  limitada: true,
  sucesso: ok,
});
