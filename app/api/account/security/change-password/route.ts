/**
 * POST /api/account/security/change-password
 *
 * Endpoint para alteração de senha do usuário logado.
 *
 * Funcionalidades:
 * - Validação de senha atual
 * - Validação de política de senha
 * - Prevenção de reutilização de senhas
 * - Rate limiting por IP e por usuário
 * - Auditoria de eventos de segurança
 * - Envio de e-mail de notificação
 * - Invalidação de sessões anteriores
 */

import { NextResponse } from "next/server";
import { getUserFromRequest, removeAuthCookie, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { changePasswordSchema } from "@/lib/validation/password-policy";
import { accountSecurityService } from "@/lib/services/account-security.service";
import { sendPasswordChangedEmail } from "@/lib/email/mailer";
import prisma from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Extrai IP do request (considerando proxies)
 */
function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return undefined;
}

/**
 * POST /api/account/security/change-password
 */
export async function POST(request: Request) {
  try {
    // 1. Autenticação
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          code: "unauthorized",
          message: "Não autenticado",
        },
        { status: 401 }
      );
    }

    const userId = currentUser.userId;

    // 2. Rate limiting (por IP e por usuário)
    const clientIp = getClientIp(request) || "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    try {
      // Limite por IP: 5 requisições a cada 15 minutos
      enforceRateLimit({
        key: `change-password:ip:${clientIp}`,
        limit: 5,
        windowMs: 15 * 60 * 1000, // 15 minutos
      });

      // Limite por usuário: 3 requisições a cada 15 minutos
      enforceRateLimit({
        key: `change-password:user:${userId}`,
        limit: 3,
        windowMs: 15 * 60 * 1000,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_limit_exceeded") {
        return NextResponse.json(
          {
            ok: false,
            code: "too_many_attempts",
            message: "Muitas tentativas. Tente novamente em alguns minutos.",
          },
          { status: 429 }
        );
      }
      throw error;
    }

    // 3. Parse e validação do body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_payload",
          message: "Payload inválido",
        },
        { status: 400 }
      );
    }

    // 4. Validação com Zod
    const parseResult = changePasswordSchema.safeParse(body);

    if (!parseResult.success) {
      const zodErrors = parseResult.error.issues;
      const firstError = zodErrors[0];
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_payload",
          message: firstError.message,
          errors: zodErrors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // 5. Alterar senha via serviço
    try {
      const result = await accountSecurityService.changePassword(userId, input, {
        ip: clientIp,
        userAgent,
      });

      // 6. Buscar dados do usuário para o e-mail
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          name: true,
        },
      });

      // 7. Enviar e-mail de notificação (não bloquear em caso de erro)
      if (user) {
        sendPasswordChangedEmail(user.email, user.name, {
          changedAt: result.passwordUpdatedAt,
          ip: clientIp,
          userAgent,
        }).catch((error) => {
          console.error("[change-password] Erro ao enviar e-mail:", error);
          // Não lançar erro - o e-mail é uma notificação secundária
        });
      }

      // 8. Limpar cookies para forçar logout
      await removeAuthCookie();

      // 9. Retornar sucesso com requireReauth
      const response = NextResponse.json(
        {
          ok: true,
          sessionInvalidated: result.sessionInvalidated,
          requireReauth: true, // Frontend deve redirecionar para login
        },
        { status: 200 }
      );

      // Garantir que o cookie foi removido no response
      response.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0, // Expira imediatamente
      });

      return response;
    } catch (error) {
      // Erros específicos do serviço
      if (error instanceof ApiError) {
        const statusMap: Record<string, number> = {
          unauthorized: 401,
          current_password_incorrect: 400,
          password_policy_failed: 400,
          password_unchanged: 400,
          password_reused: 400,
          password_not_set: 400,
        };

        const status = statusMap[error.code] || 500;

        return NextResponse.json(
          {
            ok: false,
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
          { status }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[POST /api/account/security/change-password] Error:", error);

    // Erro de banco de dados indisponível
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        {
          ok: false,
          code: "service_unavailable",
          message: "Serviço temporariamente indisponível. Tente novamente em instantes.",
        },
        { status: 503 }
      );
    }

    // Erro genérico
    return NextResponse.json(
      {
        ok: false,
        code: "internal_error",
        message: "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
