import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { requireUserId } from "../../helpers";
import { getCardPanForDev } from "@/lib/services/account-cards.service";
import crypto from "crypto";

const DEV_AUTH_HEADER = "x-dev-auth";

export const dynamic = "force-dynamic";

/**
 * SECURITY: Este endpoint expõe PAN (número completo do cartão) e deve ser usado
 * APENAS em ambiente de desenvolvimento para testes.
 * Em produção, este endpoint é completamente bloqueado.
 */
function ensureDevAuthorization(req: Request) {
  // SECURITY: Bloquear completamente em produção
  if (process.env.NODE_ENV === "production") {
    throw new ApiError({
      code: "forbidden",
      message: "Este endpoint não está disponível em produção.",
      status: 403,
    });
  }

  const expected = process.env.CARD_DEV_AUTH_TOKEN;
  if (!expected) {
    throw new ApiError({
      code: "forbidden",
      message: "Operação não autorizada.",
      status: 403,
    });
  }

  const provided = req.headers.get(DEV_AUTH_HEADER);
  if (!provided) {
    throw new ApiError({
      code: "forbidden",
      message: "Credenciais inválidas.",
      status: 403,
    });
  }

  // SECURITY: Usar comparação constant-time para evitar timing attacks
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new ApiError({
      code: "forbidden",
      message: "Credenciais inválidas.",
      status: 403,
    });
  }
}

export const POST = withApiHandler(async (context) => {
  const { req, params } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  ensureDevAuthorization(req);
  const pan = await getCardPanForDev(userId, id);

  return {
    data: { pan },
    meta: { tags: ["account", "cards"] },
  };
});
