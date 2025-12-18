import { withApiHandler } from "@/platform/api/handler";
import { ApiError } from "@/platform/api/errors";
import prisma from "@/platform/db/db";
import { getUserFromRequest } from "@/modules/auth/application/session";
import { z } from 'zod';

const RecurringItemUpdateSchema = z.object({
  descricao: z.string().min(1).optional(),
  valorUnitario: z.number().positive().optional(),
});

export const DELETE = withApiHandler(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;
  const { id } = await context.params;

  const item = await prisma.recurringItem.findUnique({
    where: { id },
  });

  if (!item) {
    throw new ApiError({ code: "not_found", message: "Item não encontrado", status: 404 });
  }

  if (item.userId !== userId) {
    throw new ApiError({ code: "forbidden", message: "Não autorizado", status: 403 });
  }

  await prisma.recurringItem.delete({
    where: { id },
  });

  return { data: { deleted: true } };
});

export const PATCH = withApiHandler(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;
  const { id } = await context.params;
  const body = await context.req.json();

  const parsed = RecurringItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { descricao, valorUnitario } = parsed.data;

  const item = await prisma.recurringItem.findUnique({
    where: { id },
  });

  if (!item) {
    throw new ApiError({ code: "not_found", message: "Item não encontrado", status: 404 });
  }

  if (item.userId !== userId) {
    throw new ApiError({ code: "forbidden", message: "Não autorizado", status: 403 });
  }

  const updated = await prisma.recurringItem.update({
    where: { id },
    data: {
      ...(descricao !== undefined && { descricao }),
      ...(valorUnitario !== undefined && { valorUnitario }),
    },
  });

  return { data: updated };
});
