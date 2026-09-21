import { GET } from '@/app/api/admin/finance/reconciliation/route';
import { contratoFinanceiro, listaVazia } from '../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/reconciliation',
  handler: GET,
  url: '/api/admin/finance/reconciliation?page=3&pageSize=20',
  sucesso: listaVazia(3, 20),
});
