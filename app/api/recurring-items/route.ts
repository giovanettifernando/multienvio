import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;

  const items = await prisma.recurringItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return { data: items };
});

export const POST = withApiHandler(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;
  const body = await context.req.json();
  const { descricao, valorUnitario } = body;

  if (!descricao || typeof valorUnitario !== "number") {
    throw new ApiError({ code: "bad_request", message: "Descrição e valor unitário são obrigatórios", status: 400 });
  }

  const item = await prisma.recurringItem.create({
    data: {
      userId,
      descricao,
      valorUnitario,
    },
  });

  return { data: item };
});
