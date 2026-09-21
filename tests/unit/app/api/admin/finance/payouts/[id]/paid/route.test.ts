import { POST } from '@/app/api/admin/finance/payouts/[id]/paid/route';
import { contratoFinanceiro, ok } from '../../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/payouts/[id]/paid',
  handler: POST,
  url: '/api/admin/finance/payouts/x1/paid',
  params: { id: 'x1' },
  corpo: { reference: 'TED-123', proofUrl: 'https://exemplo.com/comprovante.pdf' },
  corpoInvalido: { reference: '' },
  limitada: true,
  sucesso: ok,
});
