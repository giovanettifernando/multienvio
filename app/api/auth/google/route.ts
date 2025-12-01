/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth flow for User or Collector authentication.
 *
 * Query parameters:
 * - context: 'user' | 'collector' (required)
 * - redirect: URL to redirect after successful auth (optional)
 */


import { NextRequest, NextResponse } from 'next/server';
import {
  validateGoogleConfigAsync,
  buildAuthorizationUrl,
  type OAuthContext,
} from '@/lib/auth/google-oauth';

export async function GET(request: NextRequest) {
  try {
    // Validate Google OAuth configuration (loads from database if needed)
    const configValidation = await validateGoogleConfigAsync();
    if (!configValidation.valid) {
      console.error('[GOOGLE_OAUTH] Configuration error:', configValidation.error);
      return NextResponse.json(
        { error: 'Configuração OAuth incompleta', details: configValidation.error },
        { status: 500 }
      );
    }

    // Get context from query params
    const searchParams = request.nextUrl.searchParams;
    const context = searchParams.get('context') as OAuthContext | null;
    const redirectUrl = searchParams.get('redirect');

    // Validate context
    if (!context || (context !== 'user' && context !== 'collector')) {
      return NextResponse.json(
        {
          error: 'Contexto inválido',
          details: 'O parâmetro "context" deve ser "user" ou "collector"',
        },
        { status: 400 }
      );
    }

    console.log('[GOOGLE_OAUTH] Initiating flow for context:', context);

    // Build authorization URL and redirect
    const authUrl = await buildAuthorizationUrl(context, redirectUrl || undefined);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GOOGLE_OAUTH] Error initiating OAuth:', error);
    return NextResponse.json(
      { error: 'Erro ao iniciar autenticação Google' },
      { status: 500 }
    );
  }
}
