/**
 * /api/account/profile - Endpoint for PersonalForm
 *
 * Maps between the frontend Profile type and the database User model.
 * Acessa o Prisma diretamente (sem fetch server-to-server).
 *
 * Frontend Profile structure:
 * - fullName, email, phone, cpf, hasCompany, company, avatarDataUrl
 *
 * Database User fields:
 * - name, email, phone, cpf, avatarUrl, hasCompany, cnpj, razaoSocial
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { UpdateProfileSchema } from '@/shared/validation/profile';
import { userCache } from '@/platform/cache/cache';
import type { Profile } from '@/shared/types/account';

type GetProfileResponse = Profile;
type UpdateProfileResponse = Profile;

const USER_SELECT = {
  name: true,
  email: true,
  phone: true,
  cpf: true,
  avatarUrl: true,
  hasCompany: true,
  cnpj: true,
  razaoSocial: true,
} as const;

function userToProfile(user: {
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatarUrl: string | null;
  hasCompany: boolean;
  cnpj: string | null;
  razaoSocial: string | null;
}): Profile {
  return {
    fullName: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    cpf: user.cpf || '',
    hasCompany: user.hasCompany || false,
    company: user.hasCompany && user.cnpj ? {
      cnpj: user.cnpj,
      razaoSocial: user.razaoSocial || '',
    } : null,
    avatarDataUrl: user.avatarUrl || null,
  };
}

/**
 * GET /api/account/profile
 * Fetches user data directly from database and transforms to Profile format
 */
export const GET = withApiHandler<GetProfileResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: USER_SELECT,
  });

  if (!user) {
    throw new ApiError({
      code: 'not_found',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  return { data: userToProfile(user) };
});

/**
 * PUT /api/account/profile
 * Receives Profile data, validates, and saves directly to database
 */
export const PUT = withApiHandler<UpdateProfileResponse>(async (context) => {
  const session = await requireUserSession(context.req);
  const body = await context.req.json();

  // Transform from frontend Profile format to backend format
  const payload = {
    name: body.fullName?.trim() || '',
    phone: body.phone || null,
    cpf: body.cpf || null,
    avatarUrl: body.avatarDataUrl || null,
    hasCompany: body.hasCompany || false,
    cnpj: body.company?.cnpj || null,
    razaoSocial: body.company?.razaoSocial || null,
  };

  // Validate with backend schema
  const validation = UpdateProfileSchema.safeParse(payload);
  if (!validation.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const validated = validation.data;

  const updatedUser = await prisma.user.update({
    where: { id: session.userId },
    data: {
      name: validated.name,
      phone: validated.phone,
      cpf: validated.cpf,
      avatarUrl: validated.avatarUrl,
      hasCompany: validated.hasCompany,
      cnpj: validated.cnpj,
      razaoSocial: validated.razaoSocial,
    },
    select: USER_SELECT,
  });

  // Invalidar cache do usuário
  userCache.invalidate(session.userId).catch(() => {});

  return { data: userToProfile(updatedUser) };
});
