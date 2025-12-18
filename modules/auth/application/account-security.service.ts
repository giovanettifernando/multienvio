/**
 * Account Security Service
 *
 * Gerencia operações de segurança da conta do usuário:
 * - Alteração de senha
 * - Auditoria de eventos de segurança
 * - Invalidação de sessões
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { ApiError } from "@/platform/api/errors";
import { prisma } from "@/platform/db/db";
import type { RequestLogger } from "@/platform/api/types";
import {
  isPasswordReused,
  updatePasswordHistory,
  validatePasswordPolicy,
  type ChangePasswordInput,
} from "@/modules/auth/dto/password-policy";
import { sessionCache } from "@/platform/cache/cache";

/**
 * Tipos de eventos de segurança
 */
export enum SecurityEventType {
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PASSWORD_RESET = "PASSWORD_RESET",
  LOGIN_FAILED = "LOGIN_FAILED",
  SESSION_INVALIDATED = "SESSION_INVALIDATED",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED",
}

/**
 * Resultado da operação de alteração de senha
 */
export interface ChangePasswordResult {
  success: boolean;
  sessionInvalidated: boolean;
  passwordUpdatedAt: Date;
}

/**
 * Contexto da requisição para auditoria
 */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Dependências do serviço
 */
type ServiceDeps = {
  prisma: PrismaClient;
  logger?: RequestLogger;
};

type PartialDeps = Partial<ServiceDeps>;

/**
 * Service para operações de segurança da conta
 */
export class AccountSecurityService {
  private prisma: PrismaClient;
  private logger?: RequestLogger;

  constructor(deps?: PartialDeps) {
    this.prisma = deps?.prisma || prisma;
    this.logger = deps?.logger;
  }

  /**
   * Altera a senha do usuário
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    context: RequestContext = {}
  ): Promise<ChangePasswordResult> {
    const { currentPassword, newPassword } = input;

    // 1. Buscar usuário
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        passwordHistory: true,
      },
    });

    if (!user) {
      this.logger?.warn?.("Usuário não encontrado para alteração de senha", { userId });
      throw new ApiError({
        code: "unauthorized",
        message: "Não autorizado",
        status: 401,
      });
    }

    if (!user.passwordHash) {
      this.logger?.warn?.("Usuário sem senha definida (OAuth?)", { userId });
      throw new ApiError({
        code: "password_not_set",
        message: "Conta sem senha definida",
        status: 400,
      });
    }

    // 2. Validar senha atual (tempo constante)
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      this.logger?.warn?.(
        "Senha atual incorreta na tentativa de alteração",
        { userId, email: user.email, ...context }
      );

      // Registrar evento de falha
      await this.logSecurityEvent(userId, SecurityEventType.LOGIN_FAILED, context, {
        reason: "invalid_current_password",
      });

      throw new ApiError({
        code: "current_password_incorrect",
        message: "Senha atual incorreta",
        status: 400,
      });
    }

    // 3. Validar política da nova senha
    const policyResult = validatePasswordPolicy(newPassword);
    if (!policyResult.valid) {
      this.logger?.info?.("Senha não atende à política", { userId, errors: policyResult.errors });
      throw new ApiError({
        code: "password_policy_failed",
        message: "A senha não atende aos requisitos de segurança",
        status: 400,
        details: { errors: policyResult.errors },
      });
    }

    // 4. Verificar se a nova senha é igual à atual
    const isNewPasswordSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isNewPasswordSameAsCurrent) {
      throw new ApiError({
        code: "password_unchanged",
        message: "A nova senha deve ser diferente da senha atual",
        status: 400,
      });
    }

    // 5. Verificar reutilização de senha no histórico
    const passwordHistory = this.parsePasswordHistory(user.passwordHistory);
    const isReused = await isPasswordReused(newPassword, passwordHistory, bcrypt.compare);

    if (isReused) {
      this.logger?.info?.("Tentativa de reutilizar senha antiga", { userId });
      throw new ApiError({
        code: "password_reused",
        message: "Esta senha foi utilizada recentemente. Escolha uma senha diferente.",
        status: 400,
      });
    }

    // 6. Hash da nova senha
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 7. Atualizar histórico de senhas
    const updatedHistory = updatePasswordHistory(user.passwordHash, passwordHistory);

    // 8. Atualizar senha no banco de dados
    const passwordUpdatedAt = new Date();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordUpdatedAt,
        passwordHistory: updatedHistory,
        updatedAt: passwordUpdatedAt,
      },
    });

    // 9. Invalidar todas as sessões via Redis (incrementa tokenVersion)
    await sessionCache.incrementTokenVersion(userId);

    this.logger?.info?.(
      "Senha alterada com sucesso",
      { userId, email: user.email, ...context }
    );

    // 10. Registrar evento de segurança
    await this.logSecurityEvent(userId, SecurityEventType.PASSWORD_CHANGED, context, {
      previousPasswordUpdatedAt: user.passwordHistory ? "exists" : "none",
    });

    // Sessões invalidadas via Redis (tokenVersion incrementado)
    const sessionInvalidated = true;

    return {
      success: true,
      sessionInvalidated,
      passwordUpdatedAt,
    };
  }

  /**
   * Registra um evento de segurança
   */
  async logSecurityEvent(
    userId: string,
    type: SecurityEventType,
    context: RequestContext = {},
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.prisma.userSecurityEvent.create({
        data: {
          userId,
          type,
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger?.error?.(
        "Erro ao registrar evento de segurança",
        { error, userId, type }
      );
      // Não lançar erro para não quebrar o fluxo principal
    }
  }

  /**
   * Busca eventos de segurança de um usuário
   */
  async getUserSecurityEvents(
    userId: string,
    options: {
      type?: SecurityEventType;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { type, limit = 50, offset = 0 } = options;

    const where = {
      userId,
      ...(type ? { type } : {}),
    };

    const [events, total] = await Promise.all([
      this.prisma.userSecurityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.userSecurityEvent.count({ where }),
    ]);

    return {
      events,
      total,
      limit,
      offset,
    };
  }

  /**
   * Parse do histórico de senhas (JSON)
   */
  private parsePasswordHistory(history: unknown): string[] | null {
    if (!history) return null;
    if (Array.isArray(history)) return history as string[];
    return null;
  }
}

/**
 * Instância singleton do serviço
 */
export const accountSecurityService = new AccountSecurityService();
