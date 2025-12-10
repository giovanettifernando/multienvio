import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth/session";
import { UserPreferencesSchema } from "@/lib/validation/account";

interface UserPreferencesResponse {
  defaultPostingUnitId: string | null;
}

/**
 * GET /api/user/preferences
 * Retorna as preferências do usuário
 */
export const GET = withApiHandler<UserPreferencesResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      defaultPostingUnitId: true,
    },
  });

  if (!user) {
    throw new ApiError({ code: "not_found", message: "Usuário não encontrado", status: 404 });
  }

  return {
    data: {
      defaultPostingUnitId: user.defaultPostingUnitId,
    },
  };
});

/**
 * PATCH /api/user/preferences
 * Atualiza as preferências do usuário
 */
export const PATCH = withApiHandler<UserPreferencesResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }

  const body = await context.req.json();

  // Validação com Zod
  const validation = UserPreferencesSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: "validation_error",
      message: validation.error.issues[0]?.message || "Dados inválidos",
      status: 400,
    });
  }

  const { defaultPostingUnitId } = validation.data;

  const updatedUser = await prisma.user.update({
    where: { id: session.userId },
    data: {
      defaultPostingUnitId: defaultPostingUnitId || null,
    },
    select: {
      defaultPostingUnitId: true,
    },
  });

  return {
    data: {
      defaultPostingUnitId: updatedUser.defaultPostingUnitId,
    },
  };
});
