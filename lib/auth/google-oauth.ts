/**
 * Google OAuth utilities for User and Collector authentication
 * Carrega credenciais do banco de dados
 */

import crypto from 'crypto';

// ============================================================================
// Cache de credenciais
// ============================================================================

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

let credentialsCache: GoogleCredentials | null = null;
let credentialsCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Invalida o cache de credenciais
 */
export function invalidateGoogleOAuthCache(): void {
  credentialsCache = null;
  credentialsCacheTime = 0;
  console.log('[GOOGLE_OAUTH] Cache invalidado');
}

/**
 * Carrega credenciais do banco de dados
 */
async function loadCredentialsFromDatabase(): Promise<GoogleCredentials | null> {
  try {
    const { prisma } = await import('@/lib/db');
    const { decrypt } = await import('@/lib/integrations/shared/encryption.service');

    const config = await prisma.googleOAuthConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return null;
    }

    // Descriptografar clientSecret
    let clientSecret = config.clientSecret;
    try {
      clientSecret = decrypt(config.clientSecret);
    } catch {
      console.warn('[GOOGLE_OAUTH] Erro ao descriptografar clientSecret');
    }

    return {
      clientId: config.clientId,
      clientSecret,
    };
  } catch (error) {
    console.error('[GOOGLE_OAUTH] Erro ao carregar credenciais do banco:', error);
    return null;
  }
}

/**
 * Obtém credenciais (com cache)
 */
async function getCredentials(): Promise<GoogleCredentials | null> {
  const now = Date.now();

  // Verificar cache
  if (credentialsCache && now - credentialsCacheTime < CACHE_TTL) {
    return credentialsCache;
  }

  // Tentar carregar do banco
  const dbCredentials = await loadCredentialsFromDatabase();
  if (dbCredentials) {
    credentialsCache = dbCredentials;
    credentialsCacheTime = now;
    return dbCredentials;
  }

  // Fallback para variáveis de ambiente (retrocompatibilidade)
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    const envCredentials = {
      clientId: envClientId,
      clientSecret: envClientSecret,
    };
    credentialsCache = envCredentials;
    credentialsCacheTime = now;
    return envCredentials;
  }

  return null;
}

/**
 * Obtém credenciais síncronas (do cache ou env)
 * Usado quando não é possível fazer chamadas async
 */
function getCredentialsSync(): GoogleCredentials | null {
  // Tentar cache primeiro
  if (credentialsCache) {
    return credentialsCache;
  }

  // Fallback para variáveis de ambiente
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
    };
  }

  return null;
}

// ============================================================================
// Configuração
// ============================================================================

// Get base URL from environment or construct from request
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Fallback for development
  return 'http://localhost:3000';
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/auth/google/callback`;
}

// Legacy export for backwards compatibility
export const GOOGLE_REDIRECT_URI = getRedirectUri();

// ============================================================================
// Validação
// ============================================================================

/**
 * Valida configuração Google OAuth
 */
export function validateGoogleConfig(): { valid: boolean; error?: string } {
  const credentials = getCredentialsSync();

  if (!credentials) {
    return { valid: false, error: 'Credenciais Google OAuth não estão configuradas' };
  }
  if (!credentials.clientId) {
    return { valid: false, error: 'Client ID não está configurado' };
  }
  if (!credentials.clientSecret) {
    return { valid: false, error: 'Client Secret não está configurado' };
  }
  return { valid: true };
}

/**
 * Valida configuração de forma assíncrona (carrega do banco se necessário)
 */
export async function validateGoogleConfigAsync(): Promise<{ valid: boolean; error?: string }> {
  const credentials = await getCredentials();

  if (!credentials) {
    return { valid: false, error: 'Credenciais Google OAuth não estão configuradas' };
  }
  if (!credentials.clientId) {
    return { valid: false, error: 'Client ID não está configurado' };
  }
  if (!credentials.clientSecret) {
    return { valid: false, error: 'Client Secret não está configurado' };
  }
  return { valid: true };
}

// ============================================================================
// Types
// ============================================================================

// Context types for OAuth flow
export type OAuthContext = 'user' | 'collector';

// State payload for OAuth flow
export interface OAuthState {
  context: OAuthContext;
  redirectUrl?: string;
  nonce: string;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(context: OAuthContext, redirectUrl?: string): string {
  const state: OAuthState = {
    context,
    redirectUrl,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/**
 * Valida se a URL de redirect é segura (previne open redirect)
 * Permite apenas URLs relativas ou do mesmo domínio
 */
function isValidRedirectUrl(url: string | undefined): boolean {
  if (!url) return true; // undefined/empty é válido (usa default)

  // URLs relativas são sempre válidas
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // Verificar se é do mesmo domínio
  try {
    const baseUrl = getBaseUrl();
    const redirectUrl = new URL(url, baseUrl);
    const appUrl = new URL(baseUrl);

    // Deve ser do mesmo host
    return redirectUrl.host === appUrl.host;
  } catch {
    // URL inválida = não permitir
    return false;
  }
}

/**
 * Parse and validate the state parameter
 */
export function parseState(state: string): OAuthState | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as OAuthState;

    // Validate required fields
    if (!parsed.context || !parsed.nonce) {
      return null;
    }
    if (parsed.context !== 'user' && parsed.context !== 'collector') {
      return null;
    }

    // SECURITY: Validar redirectUrl para prevenir open redirect
    if (!isValidRedirectUrl(parsed.redirectUrl)) {
      console.warn('[GOOGLE_OAUTH] Redirect URL inválida bloqueada:', parsed.redirectUrl);
      // Retornar estado sem redirectUrl em vez de falhar completamente
      return { ...parsed, redirectUrl: undefined };
    }

    return parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// OAuth Flow
// ============================================================================

/**
 * Build Google OAuth authorization URL
 */
export async function buildAuthorizationUrl(context: OAuthContext, redirectUrl?: string): Promise<string> {
  const credentials = await getCredentials();
  if (!credentials) {
    throw new Error('Credenciais Google OAuth não configuradas');
  }

  const state = generateState(context, redirectUrl);
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state,
    prompt: 'select_account', // Always show account picker
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const credentials = await getCredentials();
  if (!credentials) {
    throw new Error('Credenciais Google OAuth não configuradas');
  }

  const redirectUri = getRedirectUri();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[GOOGLE_OAUTH] Token exchange failed:', error);
    throw new Error('Falha ao trocar código por tokens');
  }

  return response.json();
}

// ============================================================================
// User Info
// ============================================================================

/**
 * Google user info from ID token or userinfo endpoint
 */
export interface GoogleUserInfo {
  sub: string; // Google's unique user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Get user info from Google using access token
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[GOOGLE_OAUTH] Failed to get user info:', error);
    throw new Error('Falha ao obter informações do usuário Google');
  }

  return response.json();
}

/**
 * Decode ID token to get user info (without verification - for debugging)
 * Note: In production, the userinfo endpoint is preferred for security
 */
export function decodeIdToken(idToken: string): GoogleUserInfo | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload as GoogleUserInfo;
  } catch {
    return null;
  }
}
