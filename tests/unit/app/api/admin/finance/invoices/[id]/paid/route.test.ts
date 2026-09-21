import { POST } from '@/app/api/admin/finance/invoices/[id]/paid/route';
import { contratoFinanceiro, ok } from '../../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/invoices/[id]/paid',
  handler: POST,
  url: '/api/admin/finance/invoices/x1/paid',
  params: { id: 'x1' },
  corpo: {},
  limitada: true,
  sucesso: ok,
});
