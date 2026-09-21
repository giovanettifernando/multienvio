import { GET } from '@/app/api/admin/finance/ledger/route';
import { contratoFinanceiro, listaVazia } from '../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/ledger',
  handler: GET,
  url: '/api/admin/finance/ledger?page=3&pageSize=20',
  sucesso: listaVazia(3, 20),
});
