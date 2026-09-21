import { GET } from '@/app/api/admin/finance/invoices/route';
import { contratoFinanceiro, listaVazia } from '../_contrato';

contratoFinanceiro({
  nome: 'app/api/admin/finance/invoices',
  handler: GET,
  url: '/api/admin/finance/invoices?page=3&pageSize=20',
  sucesso: listaVazia(3, 20),
});
