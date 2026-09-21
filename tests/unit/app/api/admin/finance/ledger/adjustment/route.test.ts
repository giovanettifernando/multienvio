import { POST } from '@/app/api/admin/finance/ledger/adjustment/route';
import { contratoFinanceiro, ok } from '../../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/ledger/adjustment',
  handler: POST,
  url: '/api/admin/finance/ledger/adjustment',
  corpo: { type: 'credit', amountCents: 1500, reason: 'acerto manual' },
  corpoInvalido: { type: 'credit', amountCents: -1, reason: 'x' },
  limitada: true,
  sucesso: ok,
});
