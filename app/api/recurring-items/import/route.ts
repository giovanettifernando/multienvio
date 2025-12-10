import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth/session";


// POST - Importar itens de CSV
export const POST = withApiHandler(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: "unauthorized", message: "Não autorizado", status: 401 });
  }
  const userId = session.userId;
  const formData = await context.req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    throw new ApiError({ code: "bad_request", message: "Arquivo não enviado", status: 400 });
  }

  // SECURITY: Limitar tamanho do arquivo para prevenir DoS (max 1MB)
  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError({
      code: "bad_request",
      message: `Arquivo muito grande. Máximo permitido: 1MB. Tamanho enviado: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      status: 400
    });
  }

  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    throw new ApiError({ code: "bad_request", message: "CSV vazio ou inválido", status: 400 });
  }

  const dataLines = lines.slice(1);
  const itemsToImport: Array<{ descricao: string; valorUnitario: number }> = [];

  for (const line of dataLines) {
    const [descricao, valorStr] = line.split(",").map((v) => v.trim());

    if (!descricao || !valorStr) {
      continue;
    }

    const valorUnitario = parseFloat(valorStr.replace(",", "."));

    if (isNaN(valorUnitario)) {
      continue;
    }

    itemsToImport.push({ descricao, valorUnitario });
  }

  if (itemsToImport.length === 0) {
    throw new ApiError({ code: "bad_request", message: "Nenhum item válido encontrado no CSV", status: 400 });
  }

  const existingDescricoes = itemsToImport.map((item) => item.descricao);
  const existing = await prisma.recurringItem.findMany({
    where: {
      userId,
      descricao: { in: existingDescricoes },
    },
  });

  const existingMap = new Map(existing.map((item) => [item.descricao, item.id]));

  const toUpdate = itemsToImport.filter((item) => existingMap.has(item.descricao));
  const toCreate = itemsToImport.filter((item) => !existingMap.has(item.descricao));

  // OTIMIZAÇÃO N+1: Atualizar em paralelo com Promise.all ao invés de sequencial
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((item) => {
        const id = existingMap.get(item.descricao);
        if (!id) return Promise.resolve();
        return prisma.recurringItem.update({
          where: { id },
          data: { valorUnitario: item.valorUnitario },
        });
      })
    );
  }

  if (toCreate.length > 0) {
    await prisma.recurringItem.createMany({
      data: toCreate.map((item) => ({
        ...item,
        userId,
      })),
    });
  }

  const allItems = await prisma.recurringItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return { data: allItems };
});
