import { z } from "zod";
import { ApiError } from "@/platform/api/errors";
import { withApiHandler } from "@/platform/api/handler";
import {
  getSystemStatus,
  updateSystemStatus,
} from "@/platform/db/system-status.service";

const updateSchema = z
  .object({
    maintenance: z.boolean().optional(),
    message: z
      .string()
      .trim()
      .min(1, "Informe uma mensagem ou remova o campo.")
      .max(280, "Use no máximo 280 caracteres.")
      .optional(),
  })
  .strict();

export const GET = withApiHandler(async ({ logger }) => {
  const status = await getSystemStatus(logger);
  return {
    data: status,
    meta: { tags: ["system", "status"] },
  };
});

export const PUT = withApiHandler(async ({ req, logger }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw ApiError.badRequest("JSON inválido no corpo da requisição.");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    throw ApiError.validation("Falha de validação.", parsed.error.format());
  }

  if (Object.keys(parsed.data).length === 0) {
    throw ApiError.badRequest("Informe ao menos um campo para atualização.");
  }

  const updated = await updateSystemStatus(parsed.data, logger);
  return {
    data: updated,
    meta: { tags: ["system", "status"] },
  };
});
