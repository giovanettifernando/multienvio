/**
 * GET/POST /api/admin/clients/[id]/recipients
 *
 * Gerencia destinatários recorrentes de um usuário (Admin)
 * Usa o mesmo service que a rota de usuário, com contexto admin para audit logs.
 */

import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { AdminPermission } from '@prisma/client';
import { parsePositiveInteger } from '@/platform/api/params';
import {
  listRecipients,
  createRecipient,
  type RecipientListResult,
  type AccountRecipientDto,
  type AdminContext,
} from '@/modules/auth/application/account-recipients.service';
import {
  validateRecipientCreateInput,
  RecipientValidationError,
} from '@/shared/validation/recipient';

type GetRecipientsResponse = RecipientListResult;

type CreateRecipientResponse = {
  message: string;
  recipient: AccountRecipientDto;
};

// GET - Listar destinatários com paginação e filtros
export const GET = withApiHandler<GetRecipientsResponse, { id: string }>(async ({ req, params, logger }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  const search = req.nextUrl.searchParams;
  const q = search.get('q') ?? undefined;
  const city = search.get('city') ?? undefined;
  const uf = search.get('uf') ?? undefined;
  const cep = search.get('cep') ?? undefined;
  const page = parsePositiveInteger(search.get('page'), 1);
  const pageSize = parsePositiveInteger(search.get('pageSize'), 20);

  const adminContext: AdminContext = {
    adminId: session.staffId,
    adminEmail: session.email,
  };

  const result = await listRecipients(
    userId,
    { q, city, uf, cep, page, pageSize },
    { logger, adminContext }
  );

  return { data: result };
});

// POST - Criar novo destinatário
export const POST = withApiHandler<CreateRecipientResponse, { id: string }>(async ({ req, params, logger }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    throw new ApiError({
      code: 'invalid_payload',
      message: 'JSON inválido.',
      status: 400,
    });
  }

  let normalized;
  try {
    normalized = validateRecipientCreateInput(payload);
  } catch (error) {
    if (error instanceof RecipientValidationError) {
      throw new ApiError({
        code: error.code,
        message: error.message,
        status: 400,
      });
    }
    throw error;
  }

  const adminContext: AdminContext = {
    adminId: session.staffId,
    adminEmail: session.email,
  };

  const recipient = await createRecipient(userId, normalized, { logger, adminContext });

  return {
    data: {
      message: 'Destinatário criado com sucesso',
      recipient,
    },
    status: 201,
  };
});
