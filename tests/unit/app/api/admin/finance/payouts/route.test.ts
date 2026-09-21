import { GET } from '@/app/api/admin/finance/payouts/route';
import { contratoFinanceiro, listaVazia } from '../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/payouts',
  handler: GET,
  url: '/api/admin/finance/payouts?page=3&pageSize=20',
  sucesso: listaVazia(3, 20),
});
