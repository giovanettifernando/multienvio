import { GET } from '@/app/api/admin/finance/chargebacks/route';
import { contratoFinanceiro, listaVazia } from '../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/chargebacks',
  handler: GET,
  url: '/api/admin/finance/chargebacks?page=3&pageSize=20',
  sucesso: listaVazia(3, 20),
});
