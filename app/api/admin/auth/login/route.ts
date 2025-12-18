import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { AdminLoginSchema } from '@/shared/validation/admin-auth';
import { prisma } from '@/platform/db/db';
import { adminSign, createAdminCookieHeader } from '@/modules/auth/application/admin-session';
import { logAdminLogin } from '@/platform/logging/audit-admin';
import { AdminPermission, StaffStatus } from '@prisma/client';
import { rateLimitByIPStrict, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { staffSessionCache } from '@/platform/cache/cache';
import { requireValidOrigin } from '@/platform/api/csrf';

type AdminLoginResponse = {
  staff: {
    id: string;
    name: string;
    email: string;
    status: StaffStatus;
    role: string | undefined;
    isSuperAdmin: boolean;
    permissions: AdminPermission[];
    lastLoginAt: string | null;
    lastAccessAt: string;
    createdAt: string;
    updatedAt: string;
  };
  message: string;
};

export const POST = withApiHandlerResponse<Record<string, never>>(async (context) => {
  const { req, logger } = context;

  // CSRF Protection - validar Origin header
  const csrfError = requireValidOrigin(req as NextRequest);
  if (csrfError) return csrfError;

  // Rate limiting por IP - STRICT (fail-close) para prevenir brute force
  // Se Redis indisponível, retorna 503 ao invés de permitir acesso
  const rateLimitError = await rateLimitByIPStrict(req as NextRequest, 'admin_login', RATE_LIMITS.LOGIN);
  if (rateLimitError) return rateLimitError;

  try {
    // Parse and validate request body
    const payload = await req.json();
    const data = AdminLoginSchema.parse(payload);

    // Normalize email
    const email = data.email.trim().toLowerCase();

    logger.info('admin_login_attempt', { email });

    // Find staff user by email with role
    const staffUser = await prisma.staffUser.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    logger.debug('admin_login_query', {
      found: !!staffUser,
      hasPasswordHash: !!staffUser?.passwordHash,
      status: staffUser?.status,
    });

    // Generic error message to not reveal if email exists
    if (!staffUser || !staffUser.passwordHash) {
      logger.warn('admin_login_user_not_found');
      return NextResponse.json(
        { message: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    logger.debug('admin_login_user_found', { staffId: staffUser.id });

    // Verify password
    const passwordValid = await bcrypt.compare(data.password, staffUser.passwordHash);

    if (!passwordValid) {
      logger.warn('admin_login_invalid_password', { staffId: staffUser.id });
      return NextResponse.json(
        { message: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    // Check if staff is active
    if (staffUser.status !== 'ACTIVE') {
      logger.warn('admin_login_inactive', { staffId: staffUser.id, status: staffUser.status });
      return NextResponse.json(
        { message: 'Conta inativa ou bloqueada' },
        { status: 403 }
      );
    }

    // Update lastLoginAt
    const now = new Date();
    await prisma.staffUser.update({
      where: { id: staffUser.id },
      data: {
        lastLoginAt: now,
        lastAccessAt: now,
      },
    });

    // Obter tokenVersion do Redis (existente ou inicializa com 1)
    const tokenVersion = await staffSessionCache.getOrInitTokenVersion(staffUser.id);

    // Create JWT token
    // SuperAdmin gets all permissions
    const jwtPermissions = staffUser.isSuperAdmin
      ? Object.values(AdminPermission)
      : staffUser.permissions;

    const token = await adminSign({
      staffId: staffUser.id,
      email: staffUser.email,
      role: staffUser.role?.name || 'operator',
      isSuperAdmin: staffUser.isSuperAdmin,
      permissions: jwtPermissions,
      tokenVersion,
    });

    // Salvar sessão no Redis
    await staffSessionCache.set(staffUser.id, {
      staffId: staffUser.id,
      email: staffUser.email,
      role: staffUser.role?.name || 'operator',
      status: staffUser.status,
      tokenVersion,
    });

    // Log admin login for audit
    try {
      await logAdminLogin(staffUser.id, staffUser.email);
    } catch (auditError) {
      logger.error('admin_login_audit_failed', { staffId: staffUser.id, err: auditError });
      // Don't fail the login if audit logging fails
    }

    // Return staff data (without passwordHash)
    const staff = {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      status: staffUser.status,
      role: staffUser.role?.name,
      isSuperAdmin: staffUser.isSuperAdmin,
      permissions: staffUser.isSuperAdmin
        ? Object.values(AdminPermission)
        : staffUser.permissions,
      lastLoginAt: staffUser.lastLoginAt?.toISOString() || null,
      lastAccessAt: (staffUser.lastAccessAt ?? now).toISOString(),
      createdAt: staffUser.createdAt.toISOString(),
      updatedAt: staffUser.updatedAt.toISOString(),
    };

    logger.info('admin_login_success', { staffId: staffUser.id });

    // Create response with Set-Cookie header
    const response = NextResponse.json({
      staff,
      message: 'Login realizado com sucesso',
    });

    // Add admin auth cookie
    response.headers.set('Set-Cookie', createAdminCookieHeader(token));

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      logger.debug('admin_login_validation_error', { issues: error.issues });
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    logger.error('admin_login_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao realizar login' },
      { status: 500 }
    );
  }
});
