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
  const { searchParams } = new URL(context.req.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return { data: [] };
  }

  const items = await prisma.recurringItem.findMany({
    where: {
      userId,
      descricao: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return { data: items };
});
