import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth/session";
import { RecurringItemCreateSchema } from "@/lib/validation/account";

interface RecurringItem {
  id: string;
  userId: string;
  descricao: string;
  valorUnitario: number;
  createdAt: string;
  updatedAt: string;
}

type RecurringItemsListResponse = RecurringItem[];

export const GET = withApiHandler<RecurringItemsListResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;

  const items = await prisma.recurringItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const result = items.map((item) => ({
    id: item.id,
    userId: item.userId,
    descricao: item.descricao,
    valorUnitario: Number(item.valorUnitario),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return { data: result };
});

type RecurringItemCreateResponse = RecurringItem;

export const POST = withApiHandler<RecurringItemCreateResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;
  const body = await context.req.json();

  // Validação com Zod
  const validation = RecurringItemCreateSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: "validation_error",
      message: validation.error.issues[0]?.message || "Dados inválidos",
      status: 400,
    });
  }

  const { descricao, valorUnitario } = validation.data;

  const item = await prisma.recurringItem.create({
    data: {
      userId,
      descricao,
      valorUnitario,
    },
  });

  const result = {
    id: item.id,
    userId: item.userId,
    descricao: item.descricao,
    valorUnitario: Number(item.valorUnitario),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };

  return { data: result };
});
