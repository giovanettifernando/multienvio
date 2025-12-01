
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { AdminLoginSchema } from '@/lib/validation/admin-auth';
import { prisma } from '@/lib/db';
import { adminSign, createAdminCookieHeader } from '@/lib/auth/admin-session';
import { logAdminLogin } from '@/lib/audit-admin';
import { AdminPermission } from '@prisma/client';
import { rateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting por IP para prevenir brute force
  const rateLimitError = rateLimitByIP(request, 'admin_login', RATE_LIMITS.LOGIN);
  if (rateLimitError) return rateLimitError;

  try {
    // Parse and validate request body
    const payload = await request.json();
    const data = AdminLoginSchema.parse(payload);

    // Normalize email
    const email = data.email.trim().toLowerCase();

    console.log('[ADMIN_LOGIN] Attempting login for:', email);

    // Find staff user by email with role
    const staffUser = await prisma.staffUser.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    console.log('[ADMIN_LOGIN] Query result - Staff user found:', !!staffUser);
    console.log('[ADMIN_LOGIN] Staff email:', staffUser?.email);
    console.log('[ADMIN_LOGIN] Staff ID:', staffUser?.id);
    console.log('[ADMIN_LOGIN] Password hash exists:', !!staffUser?.passwordHash);
    console.log('[ADMIN_LOGIN] Status:', staffUser?.status);
    console.log('[ADMIN_LOGIN] IsSuperAdmin:', staffUser?.isSuperAdmin);
    console.log('[ADMIN_LOGIN] Permissions:', staffUser?.permissions);

    // Generic error message to not reveal if email exists
    if (!staffUser || !staffUser.passwordHash) {
      console.log('[ADMIN_LOGIN_ERROR] Staff user not found or no password hash');
      return NextResponse.json(
        { message: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    console.log('[ADMIN_LOGIN] Staff user found:', staffUser.id);

    // Verify password
    const passwordValid = await bcrypt.compare(data.password, staffUser.passwordHash);

    if (!passwordValid) {
      console.log('[ADMIN_LOGIN_ERROR] Invalid password');
      return NextResponse.json(
        { message: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    // Check if staff is active
    if (staffUser.status !== 'ACTIVE') {
      console.log('[ADMIN_LOGIN_ERROR] Staff user is not active:', staffUser.status);
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

    // Create JWT token
    const token = await adminSign({
      staffId: staffUser.id,
      email: staffUser.email,
      role: staffUser.role?.name || 'operator',
      isSuperAdmin: staffUser.isSuperAdmin,
      permissions: staffUser.permissions,
      tokenVersion: staffUser.tokenVersion,
    });

    // Log admin login for audit
    try {
      await logAdminLogin(staffUser.id, staffUser.email);
    } catch (auditError) {
      console.error('[ADMIN_LOGIN] Failed to log audit:', auditError);
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

    console.log('[ADMIN_LOGIN] Login successful for:', email);

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
      console.log('[ADMIN_LOGIN_ERROR] Validation error:', error.issues);
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

    console.error('[ADMIN_LOGIN_ERROR] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Erro ao realizar login' },
      { status: 500 }
    );
  }
}
