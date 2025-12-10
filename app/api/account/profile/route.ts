/**
 * /api/account/profile - Adapter endpoint for PersonalForm
 *
 * This endpoint maps between the frontend Profile type and the backend /api/account/me endpoint.
 *
 * Frontend Profile structure:
 * - fullName, email, phone, cpf, hasCompany, company, avatarDataUrl
 *
 * Backend /api/account/me structure:
 * - name, email, phone, cpf, avatarUrl
 *
 * Flow:
 * 1. GET: Fetch from /api/account/me → transform to Profile → return
 * 2. PUT: Receive Profile → transform to backend format → save to /api/account/me → return
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import type { Profile } from "@/types/account";
import { z } from 'zod';

type GetProfileResponse = Profile;

type UpdateProfileResponse = Profile;

const UpdateProfileSchema = z.object({
  fullName: z.string().min(1, 'Nome completo é obrigatório').max(200, 'Nome muito longo'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  hasCompany: z.boolean().optional(),
  company: z.object({
    cnpj: z.string().min(1, 'CNPJ é obrigatório'),
    razaoSocial: z.string().min(1, 'Razão Social é obrigatória'),
  }).nullable().optional(),
  avatarDataUrl: z.string().nullable().optional(),
});

function resolveBaseUrl(reqUrl: string): string {
  const rawEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (rawEnv) {
    const sanitized = rawEnv.replace(/^['"`]+|['"`]+$/g, "");
    try {
      const url = new URL(sanitized);
      return url.origin;
    } catch {
      // Fallback to request origin
    }
  }

  return new URL(reqUrl).origin;
}

function resolveMeEndpoint(reqUrl: string): string {
  const baseUrl = resolveBaseUrl(reqUrl);
  return new URL("/api/account/me", baseUrl).toString();
}

/**
 * GET /api/account/profile
 * Fetches user data from /api/account/me and transforms it to Profile format
 */
export const GET = withApiHandler<GetProfileResponse>(async (context) => {
  const cookieHeader = context.req.headers.get('cookie') || '';
  const meEndpoint = resolveMeEndpoint(context.req.url);

  const response = await fetch(meEndpoint, {
    headers: { 'Cookie': cookieHeader },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch profile' }));
    throw new ApiError({
      code: 'upstream_error',
      message: error.message || 'Failed to fetch profile',
      status: response.status,
    });
  }

  const json = await response.json();

  // Handle standardized API response { data: { success, user }, error, meta }
  const data = json.data ?? json;

  if (!data.user) {
    throw new ApiError({
      code: 'invalid_response',
      message: 'Invalid response from server',
      status: 500,
    });
  }

  const user = data.user;

  const profile: Profile = {
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

  return { data: profile };
});

/**
 * PUT /api/account/profile
 * Receives Profile data, transforms it, and saves to /api/account/me
 */
export const PUT = withApiHandler<UpdateProfileResponse>(async (context) => {
  const body = await context.req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const profile = parsed.data;
  const cookieHeader = context.req.headers.get('cookie') || '';

  const payload = {
    name: profile.fullName?.trim() || '',
    phone: profile.phone || null,
    cpf: profile.cpf || null,
    avatarUrl: profile.avatarDataUrl || null,
    hasCompany: profile.hasCompany || false,
    cnpj: profile.company?.cnpj || null,
    razaoSocial: profile.company?.razaoSocial || null,
  };

  const meEndpoint = resolveMeEndpoint(context.req.url);
  const response = await fetch(meEndpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to save profile' }));
    throw new ApiError({
      code: 'upstream_error',
      message: error.message || 'Failed to save profile',
      status: response.status,
    });
  }

  const json = await response.json();

  // Handle standardized API response { data: { success, user }, error, meta }
  const data = json.data ?? json;

  if (!data.user) {
    throw new ApiError({
      code: 'invalid_response',
      message: 'Invalid response from server',
      status: 500,
    });
  }

  const user = data.user;

  const savedProfile: Profile = {
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

  return { data: savedProfile };
});
