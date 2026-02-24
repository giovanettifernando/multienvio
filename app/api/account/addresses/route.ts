/**
 * GET /api/account/addresses - Lista endereços do usuário
 * POST /api/account/addresses - Cria novo endereço
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AddressSchema } from '@/shared/validation/address';
import { logger } from '@/platform/logging/logger';

type AddressDto = {
  id: string;
  label: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type GetAddressesResponse = {
  success: boolean;
  addresses: AddressDto[];
};

type CreateAddressResponse = {
  success: boolean;
  message: string;
  address: AddressDto;
};

/**
 * GET /api/account/addresses
 * Lista todos os endereços do usuário autenticado
 */
export const GET = withApiHandler<GetAddressesResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  // Buscar endereços do usuário ordenados por: default primeiro, depois por data de criação
  const addresses = await prisma.address.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      label: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { isDefault: 'desc' }, // Default primeiro
      { createdAt: 'desc' },  // Mais recente depois
    ],
  });

  return {
    data: {
      success: true,
      addresses: addresses.map(addr => ({
        ...addr,
        createdAt: addr.createdAt.toISOString(),
        updatedAt: addr.updatedAt.toISOString(),
      })),
    },
    headers: { 'Cache-Control': 'private, max-age=300' }, // 5min — endereços mudam raramente
  };
});

/**
 * POST /api/account/addresses
 * Cria um novo endereço para o usuário autenticado
 */
export const POST = withApiHandler<CreateAddressResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const body = await context.req.json();

  // Validar dados com Zod
  const validation = AddressSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'address_validation_error', errors: validation.error.flatten() }, 'Address validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const validated = validation.data;

  // Se isDefault=true, desmarcar todos os outros endereços como default
  if (validated.isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // Criar endereço
  const address = await prisma.address.create({
    data: {
      userId: session.userId,
      label: validated.label,
      cep: validated.cep,
      logradouro: validated.logradouro,
      numero: validated.numero,
      complemento: validated.complemento,
      bairro: validated.bairro,
      cidade: validated.cidade,
      uf: validated.uf,
      isDefault: validated.isDefault,
    },
    select: {
      id: true,
      label: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info({ event: 'address_created', addressId: address.id, userId: session.userId }, 'Address created');

  return {
    data: {
      success: true,
      message: 'Endereço criado com sucesso',
      address: {
        ...address,
        createdAt: address.createdAt.toISOString(),
        updatedAt: address.updatedAt.toISOString(),
      },
    },
    status: 201,
  };
});
