/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth flow for User or Collector authentication.
 *
 * Query parameters:
 * - context: 'user' | 'collector' (required)
 * - redirect: URL to redirect after successful auth (optional)
 */

import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/lib/api/handler';
import {
  validateGoogleConfigAsync,
  buildAuthorizationUrl,
  type OAuthContext,
} from '@/lib/auth/google-oauth';

export const GET = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  try {
    // Validate Google OAuth configuration (loads from database if needed)
    const configValidation = await validateGoogleConfigAsync();
    if (!configValidation.valid) {
      logger.error('google_oauth_config_error', { error: configValidation.error });
      return NextResponse.json(
        { error: 'Configuração OAuth incompleta', details: configValidation.error },
        { status: 500 }
      );
    }

    // Get context from query params
    const searchParams = req.nextUrl.searchParams;
    const oauthContext = searchParams.get('context') as OAuthContext | null;
    const redirectUrl = searchParams.get('redirect');

    // Validate context
    if (!oauthContext || (oauthContext !== 'user' && oauthContext !== 'collector')) {
      return NextResponse.json(
        {
          error: 'Contexto inválido',
          details: 'O parâmetro "context" deve ser "user" ou "collector"',
        },
        { status: 400 }
      );
    }

    logger.info('google_oauth_initiate', { context: oauthContext });

    // Build authorization URL and redirect
    const authUrl = await buildAuthorizationUrl(oauthContext, redirectUrl || undefined);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error('google_oauth_initiate_error', { err: error });
    return NextResponse.json(
      { error: 'Erro ao iniciar autenticação Google' },
      { status: 500 }
    );
  }
});
