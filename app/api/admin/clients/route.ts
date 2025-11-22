import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import type { AdminClient, ClientsResponse } from '@/lib/admin/types';

// Mock data - 25 clientes variados
const mockClients: AdminClient[] = [
  {
    id: 'cli_001',
    type: 'PJ',
    document: '12.345.678/0001-90',
    name: 'Tech Solutions Ltda',
    email: 'contato@techsolutions.com.br',
    phone: '(11) 98765-4321',
    createdAt: '2024-01-15T10:30:00Z',
    status: 'active',
    walletBalance: 15000.50,
    creditsMonth: 45000.00,
    debitsMonth: 29999.50,
  },
  {
    id: 'cli_002',
    type: 'PF',
    document: '123.456.789-00',
    name: 'João Silva Santos',
    email: 'joao.silva@email.com',
    phone: '(21) 99876-5432',
    createdAt: '2024-02-20T14:15:00Z',
    status: 'active',
    walletBalance: 2500.75,
    creditsMonth: 8000.00,
    debitsMonth: 5499.25,
  },
  {
    id: 'cli_003',
    type: 'PJ',
    document: '98.765.432/0001-10',
    name: 'Comércio e Importação ABC',
    email: 'financeiro@abcimport.com',
    phone: '(11) 3456-7890',
    createdAt: '2024-03-10T09:00:00Z',
    status: 'suspended',
    walletBalance: 500.00,
    creditsMonth: 12000.00,
    debitsMonth: 11500.00,
  },
  {
    id: 'cli_004',
    type: 'PF',
    document: '987.654.321-00',
    name: 'Maria Oliveira Costa',
    email: 'maria.costa@gmail.com',
    phone: null,
    createdAt: '2024-03-22T16:45:00Z',
    status: 'active',
    walletBalance: 150.00,
    creditsMonth: 2000.00,
    debitsMonth: 1850.00,
  },
  {
    id: 'cli_005',
    type: 'PJ',
    document: '11.222.333/0001-44',
    name: 'Logística Express SA',
    email: 'admin@logexpress.com.br',
    phone: '(41) 3333-4444',
    createdAt: '2024-01-05T08:20:00Z',
    status: 'blocked',
    walletBalance: 0.00,
    creditsMonth: 0.00,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_006',
    type: 'PF',
    document: '111.222.333-44',
    name: 'Pedro Henrique Alves',
    email: 'pedro.alves@outlook.com',
    phone: '(85) 98888-7777',
    createdAt: '2024-04-01T11:30:00Z',
    status: 'active',
    walletBalance: 1000.00,
    creditsMonth: 1000.00,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_007',
    type: 'PJ',
    document: '22.333.444/0001-55',
    name: 'E-commerce Brasil Ltda',
    email: 'suporte@ecommercebr.com',
    phone: '(11) 2222-3333',
    createdAt: '2024-02-14T13:00:00Z',
    status: 'active',
    walletBalance: 8750.30,
    creditsMonth: 28000.00,
    debitsMonth: 19249.70,
  },
  {
    id: 'cli_008',
    type: 'PF',
    document: '222.333.444-55',
    name: 'Ana Paula Ferreira',
    email: 'ana.ferreira@yahoo.com.br',
    phone: '(31) 97777-6666',
    createdAt: '2024-03-18T10:15:00Z',
    status: 'suspended',
    walletBalance: 0.00,
    creditsMonth: 5000.00,
    debitsMonth: 5000.00,
  },
  {
    id: 'cli_009',
    type: 'PJ',
    document: '33.444.555/0001-66',
    name: 'Distribuidora Nacional',
    email: 'contato@distnacional.com.br',
    phone: '(19) 3444-5555',
    createdAt: '2024-01-28T15:45:00Z',
    status: 'active',
    walletBalance: 22500.00,
    creditsMonth: 68000.00,
    debitsMonth: 45500.00,
  },
  {
    id: 'cli_010',
    type: 'PF',
    document: '333.444.555-66',
    name: 'Carlos Eduardo Souza',
    email: 'carlos.souza@hotmail.com',
    phone: '(47) 99999-8888',
    createdAt: '2024-04-05T09:30:00Z',
    status: 'active',
    walletBalance: 3200.50,
    creditsMonth: 3200.50,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_011',
    type: 'PJ',
    document: '44.555.666/0001-77',
    name: 'Marketplace Digital Ltda',
    email: 'vendas@marketplace.com',
    phone: '(21) 4555-6666',
    createdAt: '2024-02-08T12:00:00Z',
    status: 'active',
    walletBalance: 12000.00,
    creditsMonth: 20000.00,
    debitsMonth: 8000.00,
  },
  {
    id: 'cli_012',
    type: 'PF',
    document: '444.555.666-77',
    name: 'Juliana Ribeiro Lima',
    email: 'ju.ribeiro@gmail.com',
    phone: null,
    createdAt: '2024-03-25T14:20:00Z',
    status: 'active',
    walletBalance: 450.75,
    creditsMonth: 900.00,
    debitsMonth: 449.25,
  },
  {
    id: 'cli_013',
    type: 'PJ',
    document: '55.666.777/0001-88',
    name: 'Indústria e Comércio XYZ',
    email: 'comercial@xyzind.com.br',
    phone: '(16) 3666-7777',
    createdAt: '2024-01-12T10:00:00Z',
    status: 'suspended',
    walletBalance: 1500.00,
    creditsMonth: 50000.00,
    debitsMonth: 48500.00,
  },
  {
    id: 'cli_014',
    type: 'PF',
    document: '555.666.777-88',
    name: 'Ricardo Mendes Pereira',
    email: 'ricardo.mendes@uol.com.br',
    phone: '(61) 98888-9999',
    createdAt: '2024-04-08T16:00:00Z',
    status: 'active',
    walletBalance: 800.00,
    creditsMonth: 800.00,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_015',
    type: 'PJ',
    document: '66.777.888/0001-99',
    name: 'Serviços Online Brasil',
    email: 'info@servicesonline.com',
    phone: '(11) 5777-8888',
    createdAt: '2024-02-25T11:45:00Z',
    status: 'active',
    walletBalance: 5600.20,
    creditsMonth: 18000.00,
    debitsMonth: 12399.80,
  },
  {
    id: 'cli_016',
    type: 'PF',
    document: '666.777.888-99',
    name: 'Fernanda Costa Rocha',
    email: 'fernanda.rocha@gmail.com',
    phone: '(71) 97777-8888',
    createdAt: '2024-03-30T13:30:00Z',
    status: 'active',
    walletBalance: 1200.00,
    creditsMonth: 1200.00,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_017',
    type: 'PJ',
    document: '77.888.999/0001-00',
    name: 'Atacado e Varejo Sul',
    email: 'vendas@atacadosul.com.br',
    phone: '(51) 3888-9999',
    createdAt: '2024-01-20T09:15:00Z',
    status: 'active',
    walletBalance: 34500.00,
    creditsMonth: 87000.00,
    debitsMonth: 52500.00,
  },
  {
    id: 'cli_018',
    type: 'PF',
    document: '777.888.999-00',
    name: 'Marcos Vinícius Santos',
    email: 'marcos.santos@bol.com.br',
    phone: '(81) 99999-0000',
    createdAt: '2024-04-12T15:50:00Z',
    status: 'active',
    walletBalance: 2300.40,
    creditsMonth: 4600.00,
    debitsMonth: 2299.60,
  },
  {
    id: 'cli_019',
    type: 'PJ',
    document: '88.999.000/0001-11',
    name: 'Tech Startup Innovation',
    email: 'contact@techstartup.io',
    phone: '(11) 9888-9999',
    createdAt: '2024-03-05T10:30:00Z',
    status: 'blocked',
    walletBalance: 0.00,
    creditsMonth: 15000.00,
    debitsMonth: 15000.00,
  },
  {
    id: 'cli_020',
    type: 'PF',
    document: '888.999.000-11',
    name: 'Beatriz Almeida Silva',
    email: 'beatriz.almeida@live.com',
    phone: null,
    createdAt: '2024-04-15T12:10:00Z',
    status: 'active',
    walletBalance: 500.00,
    creditsMonth: 500.00,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_021',
    type: 'PJ',
    document: '99.000.111/0001-22',
    name: 'Importadora Global Ltda',
    email: 'importacao@global.com',
    phone: '(27) 3999-0000',
    createdAt: '2024-02-02T14:40:00Z',
    status: 'active',
    walletBalance: 45600.80,
    creditsMonth: 113000.00,
    debitsMonth: 67399.20,
  },
  {
    id: 'cli_022',
    type: 'PF',
    document: '999.000.111-22',
    name: 'Luiz Felipe Gomes',
    email: 'luiz.gomes@terra.com.br',
    phone: '(48) 98888-7777',
    createdAt: '2024-04-18T11:20:00Z',
    status: 'active',
    walletBalance: 750.25,
    creditsMonth: 750.25,
    debitsMonth: 0.00,
  },
  {
    id: 'cli_023',
    type: 'PJ',
    document: '10.111.222/0001-33',
    name: 'Loja Virtual Premium',
    email: 'atendimento@lvpremium.com.br',
    phone: '(62) 4000-1111',
    createdAt: '2024-01-30T16:00:00Z',
    status: 'blocked',
    walletBalance: 0.00,
    creditsMonth: 25000.00,
    debitsMonth: 25000.00,
  },
  {
    id: 'cli_024',
    type: 'PF',
    document: '100.111.222-33',
    name: 'Camila Rodrigues Martins',
    email: 'camila.martins@gmail.com',
    phone: '(92) 97777-6666',
    createdAt: '2024-04-20T10:05:00Z',
    status: 'active',
    walletBalance: 1400.90,
    creditsMonth: 2800.00,
    debitsMonth: 1399.10,
  },
  {
    id: 'cli_025',
    type: 'PJ',
    document: '20.222.333/0001-44',
    name: 'Exportadora Brasil Mundo',
    email: 'export@brasilmundo.com',
    phone: '(11) 5111-2222',
    createdAt: '2024-02-18T13:25:00Z',
    status: 'active',
    walletBalance: 56700.00,
    creditsMonth: 146000.00,
    debitsMonth: 89300.00,
  },
];

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  // Check permission
  const permissionError = requirePermission(session, AdminPermission.CONTAS);
  if (permissionError) return permissionError;

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all';
  const status = searchParams.get('status') || 'all';

  // Filtrar
  let filtered = [...mockClients];

  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.document.includes(query)
    );
  }

  if (type !== 'all') {
    filtered = filtered.filter((c) => c.type === type);
  }

  if (status !== 'all') {
    filtered = filtered.filter((c) => c.status === status);
  }

  // Paginar
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = filtered.slice(start, end);

  const response: ClientsResponse = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
