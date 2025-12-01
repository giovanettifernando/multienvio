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

import { NextRequest, NextResponse } from "next/server";
import type { Profile } from "@/types/account";

function resolveBaseUrl(request: NextRequest): string {
  const rawEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (rawEnv) {
    const sanitized = rawEnv.replace(/^['"`]+|['"`]+$/g, "");
    try {
      const url = new URL(sanitized);
      return url.origin;
    } catch (error) {
      console.warn(
        "[account/profile] Invalid NEXT_PUBLIC_APP_URL, falling back to request origin",
        { rawEnv, error },
      );
    }
  }

  return request.nextUrl.origin;
}

function resolveMeEndpoint(request: NextRequest): string {
  const baseUrl = resolveBaseUrl(request);
  return new URL("/api/account/me", baseUrl).toString();
}


/**
 * GET /api/account/profile
 * Fetches user data from /api/account/me and transforms it to Profile format
 */
export async function GET(request: NextRequest) {
  try {
    // Forward cookies for authentication
    const cookieHeader = request.headers.get('cookie') || '';

    // Fetch from real backend endpoint
    const meEndpoint = resolveMeEndpoint(request);
    const response = await fetch(meEndpoint, {
      headers: {
        'Cookie': cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Pass through error status
      const error = await response.json().catch(() => ({ message: 'Failed to fetch profile' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      return NextResponse.json(
        { success: false, message: 'Invalid response from server' },
        { status: 500 }
      );
    }

    const user = data.user;

    // Transform backend response to frontend Profile format
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

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[GET /api/account/profile] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/account/profile
 * Receives Profile data, transforms it, and saves to /api/account/me
 */
export async function PUT(request: NextRequest) {
  try {
    const profile = (await request.json()) as Profile;
    const cookieHeader = request.headers.get('cookie') || '';

    // Transform Profile to backend format
    // Note: email is read-only in backend, so we don't send it
    const payload = {
      name: profile.fullName?.trim() || '',
      phone: profile.phone || null,
      cpf: profile.cpf || null,
      avatarUrl: profile.avatarDataUrl || null,
      hasCompany: profile.hasCompany || false,
      cnpj: profile.company?.cnpj || null,
      razaoSocial: profile.company?.razaoSocial || null,
    };

    // Save to real backend endpoint
    const meEndpoint = resolveMeEndpoint(request);
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
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      return NextResponse.json(
        { success: false, message: 'Invalid response from server' },
        { status: 500 }
      );
    }

    const user = data.user;

    // Transform saved data back to Profile format
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

    return NextResponse.json(savedProfile);
  } catch (error) {
    console.error('[PUT /api/account/profile] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
