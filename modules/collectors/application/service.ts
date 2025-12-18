/**
 * Service layer para Coletores
 * Gerencia CRUD completo de coletores com Prisma
 */

import { prisma } from '@/platform/db/db';
import type { Collector, CollectorFilters, CollectorListResponse } from './types';
import type { CollectorFormSchemaType } from './schemas';
import { Prisma, PixKeyType, AccountType } from '@prisma/client';

/**
 * Mapeia o modelo Prisma para o tipo de Collector do frontend
 */
function mapPrismaToCollector(dbCollector: Prisma.CollectorGetPayload<{
  include: { documents: true };
}>): Collector {
  const {
    id,
    status,
    pfNome,
    pfCpf,
    pfEmail,
    pfCnhNumber,
    pfCnhCategory,
    pfCnhExpires,
    pfCelular,
    pfWhatsapp,
    pfCep,
    pfLogradouro,
    pfNumero,
    pfComplemento,
    pfBairro,
    pfCidade,
    pfUf,
    pjRazaoSocial,
    pjCnpj,
    pjCep,
    pjLogradouro,
    pjNumero,
    pjComplemento,
    pjBairro,
    pjCidade,
    pjUf,
    vehiclePlate,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    commissionKind,
    commissionAmount,
    commissionAmountPerKm,
    bankMethodKind,
    bankPixType,
    bankPixKey,
    bankCode,
    bankBranch,
    bankAccount,
    bankAccountType,
    bankHolderName,
    bankHolderCnpj,
    createdAt,
    updatedAt,
    documents,
  } = dbCollector;

  // Map documents by type
  const cnhFiles = documents
    .filter((doc) => doc.type === 'cnh')
    .map((doc) => ({
      uid: doc.id,
      name: doc.filename,
      url: doc.url || undefined,
      status: 'done' as const,
    }));

  const crlvFile = documents
    .filter((doc) => doc.type === 'crlv')
    .map((doc) => ({
      uid: doc.id,
      name: doc.filename,
      url: doc.url || undefined,
      status: 'done' as const,
    }));

  const pfAddressProofFile = documents
    .filter((doc) => doc.type === 'pf_address_proof')
    .map((doc) => ({
      uid: doc.id,
      name: doc.filename,
      url: doc.url || undefined,
      status: 'done' as const,
    }));

  // Build commission object
  const commission =
    commissionKind === 'FIXA'
      ? { kind: 'fixa' as const, amount: commissionAmount ?? 0 }
      : { kind: 'porKm' as const, amountPerKm: commissionAmountPerKm ?? 0 };

  // Build bank method object
  const bank =
    bankMethodKind === 'PIX'
      ? {
          kind: 'pix' as const,
          pixType: (bankPixType?.toLowerCase() ?? 'cpf') as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random',
          pixKey: bankPixKey ?? '',
        }
      : {
          kind: 'transfer' as const,
          bankCode: bankCode ?? '',
          branch: bankBranch ?? '',
          account: bankAccount ?? '',
          accountType: (bankAccountType?.toLowerCase() ?? 'corrente') as 'corrente' | 'poupanca',
          holderName: bankHolderName ?? '',
          holderCnpj: bankHolderCnpj ?? '',
        };

  return {
    id,
    status: status === 'ACTIVE' ? 'active' : status === 'INACTIVE' ? 'inactive' : 'blocked',
    pf: {
      nome: pfNome,
      cpf: pfCpf || '',
      email: pfEmail || '',
      cnh: {
        number: pfCnhNumber,
        category: pfCnhCategory,
        expiresAt: pfCnhExpires.toISOString(),
      },
      endereco: {
        cep: pfCep,
        logradouro: pfLogradouro,
        numero: pfNumero,
        complemento: pfComplemento,
        bairro: pfBairro,
        cidade: pfCidade,
        uf: pfUf,
      },
      celular: pfCelular,
      whatsapp: pfWhatsapp,
      usarMesmoNumero: pfWhatsapp === pfCelular,
    },
    pj: {
      razaoSocial: pjRazaoSocial,
      cnpj: pjCnpj,
      endereco: {
        cep: pjCep,
        logradouro: pjLogradouro,
        numero: pjNumero,
        complemento: pjComplemento,
        bairro: pjBairro,
        cidade: pjCidade,
        uf: pjUf,
      },
      usarEnderecoFisico: false,
    },
    vehicle: {
      plate: vehiclePlate,
      brand: vehicleBrand,
      model: vehicleModel,
      year: vehicleYear,
    },
    documents: {
      cnhFiles,
      crlvFile,
      pfAddressProofFile,
    },
    commission,
    bank,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * Lista coletores com filtros e paginação
 */
export async function listCollectors(filters: CollectorFilters = {}): Promise<CollectorListResponse> {
  const {
    q,
    status,
    uf,
    cidade,
    page = 1,
    pageSize = 10,
    sort = 'updated_desc',
  } = filters;

  const where: Prisma.CollectorWhereInput = {
    // Only show collectors with verified emails (excludes BLOCKED collectors awaiting email verification)
    pfEmailVerified: true,
  };

  // Status filter
  if (status && status !== 'all') {
    where.status = status === 'active' ? 'ACTIVE' : status === 'inactive' ? 'INACTIVE' : 'BLOCKED';
  }

  // Search query (nome or CNPJ)
  if (q) {
    where.OR = [
      { pfNome: { contains: q, mode: 'insensitive' } },
      { pjRazaoSocial: { contains: q, mode: 'insensitive' } },
      { pjCnpj: { contains: q.replace(/\D/g, '') } },
    ];
  }

  // Location filters
  if (uf) {
    where.OR = [
      { pfUf: uf },
      { pjUf: uf },
    ];
  }

  if (cidade) {
    where.OR = [
      { pfCidade: { contains: cidade, mode: 'insensitive' } },
      { pjCidade: { contains: cidade, mode: 'insensitive' } },
    ];
  }

  // Order by
  let orderBy: Prisma.CollectorOrderByWithRelationInput = { updatedAt: 'desc' };
  if (sort === 'updated_asc') orderBy = { updatedAt: 'asc' };
  if (sort === 'name_asc') orderBy = { pfNome: 'asc' };
  if (sort === 'name_desc') orderBy = { pfNome: 'desc' };

  const [total, dbCollectors] = await Promise.all([
    prisma.collector.count({ where }),
    prisma.collector.findMany({
      where,
      include: { documents: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = dbCollectors.map(mapPrismaToCollector);

  return {
    items,
    total,
    page,
    pageSize,
  };
}

/**
 * Busca um coletor por ID
 */
export async function getCollectorById(id: string): Promise<Collector | null> {
  const dbCollector = await prisma.collector.findUnique({
    where: { id },
    include: { documents: true },
  });

  if (!dbCollector) return null;

  return mapPrismaToCollector(dbCollector);
}

/**
 * Cria um novo coletor
 */
export async function createCollector(data: CollectorFormSchemaType): Promise<Collector> {
  const { pf, pj, vehicle, documents, commission, bank } = data;

  // Prepare commission data
  const commissionData =
    commission.kind === 'fixa'
      ? {
          commissionKind: 'FIXA' as const,
          commissionAmount: commission.amount,
          commissionAmountPerKm: null,
        }
      : {
          commissionKind: 'POR_KM' as const,
          commissionAmount: null,
          commissionAmountPerKm: commission.amountPerKm,
        };

  // Prepare bank data
  const bankData =
    bank.kind === 'pix'
      ? {
          bankMethodKind: 'PIX' as const,
          bankPixType: bank.pixType.toUpperCase() as PixKeyType,
          bankPixKey: bank.pixKey,
          bankCode: null,
          bankBranch: null,
          bankAccount: null,
          bankAccountType: null,
          bankHolderName: null,
          bankHolderCnpj: null,
        }
      : {
          bankMethodKind: 'TRANSFER' as const,
          bankPixType: null,
          bankPixKey: null,
          bankCode: bank.bankCode,
          bankBranch: bank.branch,
          bankAccount: bank.account,
          bankAccountType: bank.accountType.toUpperCase() as AccountType,
          bankHolderName: bank.holderName,
          bankHolderCnpj: bank.holderCnpj,
        };

  // Create collector with documents
  const dbCollector = await prisma.collector.create({
    data: {
      status: 'ACTIVE',
      pfNome: pf.nome,
      pfCpf: pf.cpf.replace(/\D/g, ''),
      pfEmail: pf.email,
      pfCnhNumber: pf.cnh.number,
      pfCnhCategory: pf.cnh.category,
      pfCnhExpires: new Date(pf.cnh.expiresAt),
      pfCelular: pf.celular,
      pfWhatsapp: pf.usarMesmoNumero ? pf.celular : (pf.whatsapp ?? null),
      pfCep: pf.endereco.cep ?? null,
      pfLogradouro: pf.endereco.logradouro ?? null,
      pfNumero: pf.endereco.numero ?? null,
      pfComplemento: pf.endereco.complemento ?? null,
      pfBairro: pf.endereco.bairro ?? null,
      pfCidade: pf.endereco.cidade ?? null,
      pfUf: pf.endereco.uf ?? null,
      pjRazaoSocial: pj.razaoSocial,
      pjCnpj: pj.cnpj.replace(/\D/g, ''),
      pjCep: pj.usarEnderecoFisico ? (pf.endereco.cep ?? null) : (pj.endereco.cep ?? null),
      pjLogradouro: pj.usarEnderecoFisico ? (pf.endereco.logradouro ?? null) : (pj.endereco.logradouro ?? null),
      pjNumero: pj.usarEnderecoFisico ? (pf.endereco.numero ?? null) : (pj.endereco.numero ?? null),
      pjComplemento: pj.usarEnderecoFisico ? (pf.endereco.complemento ?? null) : (pj.endereco.complemento ?? null),
      pjBairro: pj.usarEnderecoFisico ? (pf.endereco.bairro ?? null) : (pj.endereco.bairro ?? null),
      pjCidade: pj.usarEnderecoFisico ? (pf.endereco.cidade ?? null) : (pj.endereco.cidade ?? null),
      pjUf: pj.usarEnderecoFisico ? (pf.endereco.uf ?? null) : (pj.endereco.uf ?? null),
      vehiclePlate: vehicle.plate,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model ?? null,
      vehicleYear: vehicle.year ?? null,
      ...commissionData,
      ...bankData,
      documents: {
        create: [
          ...documents.cnhFiles.map((file) => ({
            type: 'cnh',
            filename: file.name,
            url: file.url ?? '',
          })),
          ...documents.crlvFile.map((file) => ({
            type: 'crlv',
            filename: file.name,
            url: file.url ?? '',
          })),
          ...documents.pfAddressProofFile.map((file) => ({
            type: 'pf_address_proof',
            filename: file.name,
            url: file.url ?? '',
          })),
        ],
      },
    },
    include: { documents: true },
  });

  return mapPrismaToCollector(dbCollector);
}

/**
 * Atualiza um coletor
 */
export async function updateCollector(
  id: string,
  data: CollectorFormSchemaType
): Promise<Collector> {
  const { pf, pj, vehicle, documents, commission, bank } = data;

  // Prepare commission data
  const commissionData =
    commission.kind === 'fixa'
      ? {
          commissionKind: 'FIXA' as const,
          commissionAmount: commission.amount,
          commissionAmountPerKm: null,
        }
      : {
          commissionKind: 'POR_KM' as const,
          commissionAmount: null,
          commissionAmountPerKm: commission.amountPerKm,
        };

  // Prepare bank data
  const bankData =
    bank.kind === 'pix'
      ? {
          bankMethodKind: 'PIX' as const,
          bankPixType: bank.pixType.toUpperCase() as PixKeyType,
          bankPixKey: bank.pixKey,
          bankCode: null,
          bankBranch: null,
          bankAccount: null,
          bankAccountType: null,
          bankHolderName: null,
          bankHolderCnpj: null,
        }
      : {
          bankMethodKind: 'TRANSFER' as const,
          bankPixType: null,
          bankPixKey: null,
          bankCode: bank.bankCode,
          bankBranch: bank.branch,
          bankAccount: bank.account,
          bankAccountType: bank.accountType.toUpperCase() as AccountType,
          bankHolderName: bank.holderName,
          bankHolderCnpj: bank.holderCnpj,
        };

  // Delete old documents and create new ones
  await prisma.collectorDocument.deleteMany({
    where: { collectorId: id },
  });

  const dbCollector = await prisma.collector.update({
    where: { id },
    data: {
      pfNome: pf.nome,
      pfCpf: pf.cpf.replace(/\D/g, ''),
      pfEmail: pf.email,
      pfCnhNumber: pf.cnh.number,
      pfCnhCategory: pf.cnh.category,
      pfCnhExpires: new Date(pf.cnh.expiresAt),
      pfCelular: pf.celular,
      pfWhatsapp: pf.usarMesmoNumero ? pf.celular : (pf.whatsapp ?? null),
      pfCep: pf.endereco.cep ?? null,
      pfLogradouro: pf.endereco.logradouro ?? null,
      pfNumero: pf.endereco.numero ?? null,
      pfComplemento: pf.endereco.complemento ?? null,
      pfBairro: pf.endereco.bairro ?? null,
      pfCidade: pf.endereco.cidade ?? null,
      pfUf: pf.endereco.uf ?? null,
      pjRazaoSocial: pj.razaoSocial,
      pjCnpj: pj.cnpj.replace(/\D/g, ''),
      pjCep: pj.usarEnderecoFisico ? (pf.endereco.cep ?? null) : (pj.endereco.cep ?? null),
      pjLogradouro: pj.usarEnderecoFisico ? (pf.endereco.logradouro ?? null) : (pj.endereco.logradouro ?? null),
      pjNumero: pj.usarEnderecoFisico ? (pf.endereco.numero ?? null) : (pj.endereco.numero ?? null),
      pjComplemento: pj.usarEnderecoFisico ? (pf.endereco.complemento ?? null) : (pj.endereco.complemento ?? null),
      pjBairro: pj.usarEnderecoFisico ? (pf.endereco.bairro ?? null) : (pj.endereco.bairro ?? null),
      pjCidade: pj.usarEnderecoFisico ? (pf.endereco.cidade ?? null) : (pj.endereco.cidade ?? null),
      pjUf: pj.usarEnderecoFisico ? (pf.endereco.uf ?? null) : (pj.endereco.uf ?? null),
      vehiclePlate: vehicle.plate,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model ?? null,
      vehicleYear: vehicle.year ?? null,
      ...commissionData,
      ...bankData,
      documents: {
        create: [
          ...documents.cnhFiles.map((file) => ({
            type: 'cnh',
            filename: file.name,
            url: file.url ?? '',
          })),
          ...documents.crlvFile.map((file) => ({
            type: 'crlv',
            filename: file.name,
            url: file.url ?? '',
          })),
          ...documents.pfAddressProofFile.map((file) => ({
            type: 'pf_address_proof',
            filename: file.name,
            url: file.url ?? '',
          })),
        ],
      },
    },
    include: { documents: true },
  });

  return mapPrismaToCollector(dbCollector);
}

/**
 * Deleta um coletor
 */
export async function deleteCollector(id: string): Promise<void> {
  await prisma.collector.delete({
    where: { id },
  });
}

/**
 * Atualiza o status de um coletor (active/blocked)
 */
export async function updateCollectorStatus(
  id: string,
  status: 'active' | 'blocked'
): Promise<Collector> {
  const dbCollector = await prisma.collector.update({
    where: { id },
    data: {
      status: status === 'active' ? 'ACTIVE' : 'BLOCKED',
    },
    include: { documents: true },
  });

  return mapPrismaToCollector(dbCollector);
}
