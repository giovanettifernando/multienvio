/**
 * GET/PUT/DELETE /api/admin/clients/[id]/recipients/[recipientId]
 *
 * Operações admin em destinatário específico do cliente.
 * Usa o service unificado com AdminContext para audit logs.
 */
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { AdminPermission } from '@prisma/client';
import {
  getRecipient,
  updateRecipient,
  deleteRecipient,
  type AccountRecipientDto,
  type AdminContext,
} from '@/modules/auth/application/account-recipients.service';
import { validateRecipientUpdateInput } from '@/shared/validation/recipient';

type Params = { id: string; recipientId: string };

async function validateClientExists(clientId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'client_not_found',
      message: 'Cliente não encontrado.',
      status: 404,
    });
  }

  return user.id;
}

export const GET = withApiHandler<AccountRecipientDto>(async ({ req, params, logger }) => {
  const { id: clientId, recipientId } = params as Params;

  await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = await validateClientExists(clientId);

  const recipient = await getRecipient(userId, recipientId, { logger });

  return {
    data: recipient,
    meta: { tags: ['admin', 'clients', 'recipients'] },
  };
});

export const PUT = withApiHandler<AccountRecipientDto>(async ({ req, params, logger }) => {
  const { id: clientId, recipientId } = params as Params;

  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = await validateClientExists(clientId);

  const adminContext: AdminContext = {
    adminId: session.staffId,
    adminEmail: session.email,
  };

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
    normalized = validateRecipientUpdateInput(payload);
  } catch (error) {
    if (error instanceof Error) {
      throw new ApiError({
        code: 'validation_error',
        message: error.message,
        status: 400,
      });
    }
    throw error;
  }

  const updated = await updateRecipient(userId, recipientId, normalized, {
    logger,
    adminContext,
  });

  return {
    data: updated,
    meta: { tags: ['admin', 'clients', 'recipients'] },
  };
});

export const DELETE = withApiHandler<{ success: boolean }>(async ({ req, params, logger }) => {
  const { id: clientId, recipientId } = params as Params;

  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = await validateClientExists(clientId);

  const adminContext: AdminContext = {
    adminId: session.staffId,
    adminEmail: session.email,
  };

  await deleteRecipient(userId, recipientId, { logger, adminContext });

  return {
    data: { success: true },
    meta: { tags: ['admin', 'clients', 'recipients'] },
  };
});
