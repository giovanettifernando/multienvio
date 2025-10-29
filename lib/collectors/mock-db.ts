import type { Collector } from './types';

const now = () => new Date().toISOString();

const fakePdf = 'data:application/pdf;base64,ZmFrZWZpbGVfY29udGV1ZG8='; // mock
const fakeImage = 'data:image/png;base64,ZmFrZWltYWdlY29udGV1ZG8=';

export const db = {
  collectors: [
    {
      id: 'col-1',
      status: 'active' as const,
      pf: {
        nome: 'João da Silva Santos',
        cnh: {
          number: '12345678901',
          category: 'D',
          expiresAt: '2026-12-31',
        },
        endereco: {
          cep: '60025-101',
          logradouro: 'Rua Barão de Aracati',
          numero: '1200',
          complemento: 'Apto 402',
          bairro: 'Meireles',
          cidade: 'Fortaleza',
          uf: 'CE',
        },
        celular: '(85) 98765-4321',
        whatsapp: '(85) 98765-4321',
        usarMesmoNumero: true,
      },
      pj: {
        razaoSocial: 'Translog Nordeste Logística Ltda',
        cnpj: '12.345.678/0001-99',
        email: 'contato@translog.com.br',
        telefone: '(85) 3232-4455',
        endereco: {
          cep: '60025-101',
          logradouro: 'Rua Barão de Aracati',
          numero: '1200',
          complemento: 'Sala 402',
          bairro: 'Meireles',
          cidade: 'Fortaleza',
          uf: 'CE',
        },
      },
      vehicle: {
        plate: 'ABC1D23',
        brand: 'Fiat',
        model: 'Ducato',
        year: '2021',
        renavam: '12345678901',
      },
      documents: {
        cnhFiles: [
          { uid: 'cnh-1', name: 'CNH Frente', url: fakeImage, status: 'done' as const },
          { uid: 'cnh-2', name: 'CNH Verso', url: fakeImage, status: 'done' as const },
        ],
        crlvFile: [{ uid: 'crlv-1', name: 'CRLV', url: fakePdf, status: 'done' as const }],
        pfAddressProofFile: [{ uid: 'proof-1', name: 'Comprovante', url: fakePdf, status: 'done' as const }],
      },
      commission: { kind: 'fixa' as const, amount: 7.5 },
      bank: {
        kind: 'pix' as const,
        pixType: 'cnpj' as const,
        pixKey: '12345678000199',
      },
      createdAt: '2024-01-06T12:00:00Z',
      updatedAt: now(),
    },
    {
      id: 'col-2',
      status: 'active' as const,
      pf: {
        nome: 'Maria Oliveira Costa',
        cnh: {
          number: '9988776655',
          category: 'E',
          expiresAt: '2027-05-10',
        },
        endereco: {
          cep: '80410-150',
          logradouro: 'Av. Sete de Setembro',
          numero: '2150',
          complemento: null,
          bairro: 'Centro',
          cidade: 'Curitiba',
          uf: 'PR',
        },
        celular: '(41) 99888-7766',
        whatsapp: '(41) 99888-7766',
        usarMesmoNumero: true,
      },
      pj: {
        razaoSocial: 'Eco Coletas Sustentáveis S.A.',
        cnpj: '45.678.901/0001-55',
        email: 'financeiro@eco-coletas.com',
        telefone: '(41) 3344-5566',
        endereco: {
          cep: '80410-150',
          logradouro: 'Av. Sete de Setembro',
          numero: '2150',
          complemento: 'Sala 10',
          bairro: 'Centro',
          cidade: 'Curitiba',
          uf: 'PR',
        },
      },
      vehicle: {
        plate: 'QWE2R34',
        brand: 'Mercedes',
        model: 'Sprinter',
        year: '2022',
        renavam: '98765432109',
      },
      documents: {
        cnhFiles: [
          { uid: 'cnh-3', name: 'CNH Frente', url: fakeImage, status: 'done' as const },
          { uid: 'cnh-4', name: 'CNH Verso', url: fakeImage, status: 'done' as const },
        ],
        crlvFile: [{ uid: 'crlv-2', name: 'CRLV', url: fakePdf, status: 'done' as const }],
        pfAddressProofFile: [{ uid: 'proof-2', name: 'Comprovante', url: fakePdf, status: 'done' as const }],
      },
      commission: { kind: 'porKm' as const, amountPerKm: 1.35 },
      bank: {
        kind: 'transfer' as const,
        bankCode: '237',
        branch: '1234',
        account: '556677-8',
        accountType: 'corrente' as const,
        holderName: 'Eco Coletas Sustentáveis S.A.',
        holderCnpj: '45678901000155',
      },
      createdAt: '2024-02-18T08:30:00Z',
      updatedAt: now(),
    },
  ] as Collector[],
};
