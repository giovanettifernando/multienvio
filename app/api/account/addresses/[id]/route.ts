/**
 * PUT /api/account/addresses/[id] - Atualiza endereço
 * DELETE /api/account/addresses/[id] - Deleta endereço
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
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

type UpdateAddressResponse = {
  success: boolean;
  message: string;
  address: AddressDto;
};

type DeleteAddressResponse = {
  success: boolean;
  message: string;
};

/**
 * PUT /api/account/addresses/[id]
 * Atualiza um endereço específico
 */
export const PUT = withApiHandler<UpdateAddressResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;
  const body = await context.req.json();

  // Verificar se o endereço pertence ao usuário
  const existingAddress = await prisma.address.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existingAddress) {
    throw new ApiError({ code: 'not_found', message: 'Endereço não encontrado', status: 404 });
  }

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
      where: {
        userId: session.userId,
        isDefault: true,
        id: { not: id }
      },
      data: { isDefault: false },
    });
  }

  // Atualizar endereço
  const address = await prisma.address.update({
    where: { id },
    data: {
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

  logger.info({ event: 'address_updated', addressId: address.id, userId: session.userId }, 'Address updated');

  return {
    data: {
      success: true,
      message: 'Endereço atualizado com sucesso',
      address: {
        ...address,
        createdAt: address.createdAt.toISOString(),
        updatedAt: address.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * DELETE /api/account/addresses/[id]
 * Deleta um endereço específico
 */
export const DELETE = withApiHandler<DeleteAddressResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;

  // Verificar se o endereço pertence ao usuário
  const existingAddress = await prisma.address.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existingAddress) {
    throw new ApiError({ code: 'not_found', message: 'Endereço não encontrado', status: 404 });
  }

  // Deletar endereço
  await prisma.address.delete({
    where: { id },
  });

  logger.info({ event: 'address_deleted', addressId: id, userId: session.userId }, 'Address deleted');

  return {
    data: {
      success: true,
      message: 'Endereço removido com sucesso',
    },
  };
});
