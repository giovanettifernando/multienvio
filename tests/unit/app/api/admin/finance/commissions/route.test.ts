import { GET } from '@/app/api/admin/finance/commissions/route';
import { contratoFinanceiro, listaVazia } from '../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/commissions',
  handler: GET,
  url: '/api/admin/finance/commissions?page=3&pageSize=20',
  sucesso: listaVazia(3, 20),
});
