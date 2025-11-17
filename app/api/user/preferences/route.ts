import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/preferences
 * Retorna as preferências do usuário
 */
export const GET = withApiHandler(async (context) => {
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
export const PATCH = withApiHandler(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }

  const body = await context.req.json();
  const { defaultPostingUnitId } = body;

  // Validar que defaultPostingUnitId é string ou null
  if (defaultPostingUnitId !== null && typeof defaultPostingUnitId !== "string") {
    throw new ApiError({
      code: "bad_request",
      message: "defaultPostingUnitId deve ser uma string ou null",
      status: 400,
    });
  }

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
