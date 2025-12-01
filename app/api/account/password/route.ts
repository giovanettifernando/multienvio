/**
 * DEPRECATED: Este endpoint é mantido apenas para compatibilidade com frontend antigo.
 * Redireciona para o novo endpoint de segurança em /api/account/security/change-password
 *
 * TODO: Remover após migrar frontend para usar o novo endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, removeAuthCookie, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { changePasswordSchema } from "@/lib/validation/password-policy";
import { accountSecurityService } from "@/lib/services/account-security.service";
import { sendPasswordChangedEmail } from "@/lib/email/mailer";
import prisma from "@/lib/db";


function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const currentUser = await getUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, code: "unauthorized", message: "Não autenticado" },
        { status: 401 }
      );
    }

    const userId = currentUser.userId;
    const clientIp = getClientIp(req) || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 2. Rate limiting
    try {
      enforceRateLimit({
        key: `change-password:ip:${clientIp}`,
        limit: 5,
        windowMs: 15 * 60 * 1000,
      });
      enforceRateLimit({
        key: `change-password:user:${userId}`,
        limit: 3,
        windowMs: 15 * 60 * 1000,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_limit_exceeded") {
        return NextResponse.json(
          { ok: false, code: "too_many_attempts", message: "Muitas tentativas. Tente novamente em alguns minutos." },
          { status: 429 }
        );
      }
      throw error;
    }

    // 3. Parse body (compatibilidade com frontend antigo)
    const body = await req.json();

    // Mapear campos antigos para novos
    const mappedBody = {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmNewPassword || body.confirmPassword,
    };

    console.log("[change-password] Request body:", {
      hasCurrentPassword: !!body.currentPassword,
      hasNewPassword: !!body.newPassword,
      hasConfirmNewPassword: !!body.confirmNewPassword,
      hasConfirmPassword: !!body.confirmPassword,
      mappedBody: {
        hasCurrentPassword: !!mappedBody.currentPassword,
        hasNewPassword: !!mappedBody.newPassword,
        hasConfirmPassword: !!mappedBody.confirmPassword,
      }
    });

    // 4. Validação com Zod
    const parseResult = changePasswordSchema.safeParse(mappedBody);
    if (!parseResult.success) {
      const zodErrors = parseResult.error.issues;
      const firstError = zodErrors[0];

      console.error("[change-password] Validation failed:", {
        errors: zodErrors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        })),
      });

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
        select: { email: true, name: true },
      });

      // 7. Enviar e-mail de notificação
      if (user) {
        sendPasswordChangedEmail(user.email, user.name, {
          changedAt: result.passwordUpdatedAt,
          ip: clientIp,
          userAgent,
        }).catch((error) => {
          console.error("[change-password] Erro ao enviar e-mail:", error);
        });
      }

      // 8. Limpar cookies para forçar logout
      await removeAuthCookie();

      // 9. Retornar sucesso com requireReauth
      const response = NextResponse.json(
        {
          ok: true,
          sessionInvalidated: result.sessionInvalidated,
          requireReauth: true,
        },
        { status: 200 }
      );

      // Garantir que o cookie foi removido no response
      response.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    } catch (error) {
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
    console.error("[POST /api/account/password] Error:", error);
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        { ok: false, code: "service_unavailable", message: "Serviço temporariamente indisponível." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, code: "internal_error", message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
