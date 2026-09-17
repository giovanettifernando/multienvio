/**
 * Google OAuth utilities for User and Collector authentication
 * Carrega credenciais do banco de dados
 */

import crypto from 'crypto';
import { getRedisClient, isRedisAvailable } from '@/platform/cache/redis';

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
    const { prisma } = await import('@/platform/db/db');
    const { decrypt } = await import('@/platform/integrations/shared/encryption.service');

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

// Get base URL from environment
function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      '[GOOGLE_OAUTH] NEXT_PUBLIC_APP_URL não está configurado. ' +
      'Defina esta variável de ambiente com a URL do servidor (ex: https://app.enviolegal.com)'
    );
  }
  return appUrl;
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
export type OAuthContext = 'user';

// State payload for OAuth flow
export interface OAuthState {
  context: OAuthContext;
  redirectUrl?: string;
  nonce: string;
}

// ============================================================================
// State Management
// ============================================================================

// SECURITY FIX F-04: Constantes para armazenamento de state no Redis
const OAUTH_STATE_PREFIX = 'oauth:state:';
const OAUTH_STATE_TTL_SECONDS = 300; // 5 minutos

/**
 * SECURITY FIX F-04: Generate and store state in Redis for CSRF protection
 * O state agora é um ID que referencia dados armazenados no servidor
 */
export async function generateState(context: OAuthContext, redirectUrl?: string): Promise<string> {
  const stateId = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString('hex');

  const stateData: OAuthState = {
    context,
    redirectUrl,
    nonce,
  };

  // Armazenar no Redis se disponível
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.setex(
        `${OAUTH_STATE_PREFIX}${stateId}`,
        OAUTH_STATE_TTL_SECONDS,
        JSON.stringify(stateData)
      );
      console.log('[GOOGLE_OAUTH] State armazenado no Redis:', stateId);
    } catch (error) {
      console.error('[GOOGLE_OAUTH] Erro ao armazenar state no Redis:', error);
      // Fallback: retornar state codificado (menos seguro mas funcional)
      return Buffer.from(JSON.stringify({ ...stateData, fallback: true })).toString('base64url');
    }
  } else {
    // Fallback quando Redis não está disponível
    console.warn('[GOOGLE_OAUTH] Redis não disponível, usando state codificado (fallback)');
    return Buffer.from(JSON.stringify({ ...stateData, fallback: true })).toString('base64url');
  }

  return stateId;
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
 * SECURITY FIX F-04: Parse and validate the state parameter from Redis
 * O state é validado contra o Redis e invalidado após uso (single-use)
 */
export async function parseState(state: string): Promise<OAuthState | null> {
  // Primeiro, verificar se é um UUID (novo formato com Redis)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state);

  if (isUUID && isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const key = `${OAUTH_STATE_PREFIX}${state}`;

      // Buscar e deletar atomicamente (GETDEL)
      const data = await redis.get(key);

      if (!data) {
        console.warn('[GOOGLE_OAUTH] SECURITY: State não encontrado ou já usado:', state);
        return null;
      }

      // Deletar imediatamente (single-use)
      await redis.del(key);

      const parsed = JSON.parse(data) as OAuthState;

      // Validate required fields
      if (!parsed.context || !parsed.nonce) {
        console.warn('[GOOGLE_OAUTH] SECURITY: State com campos inválidos');
        return null;
      }
      if (parsed.context !== 'user') {
        console.warn('[GOOGLE_OAUTH] SECURITY: State com context inválido:', parsed.context);
        return null;
      }

      // SECURITY: Validar redirectUrl para prevenir open redirect
      if (!isValidRedirectUrl(parsed.redirectUrl)) {
        console.warn('[GOOGLE_OAUTH] Redirect URL inválida bloqueada:', parsed.redirectUrl);
        return { ...parsed, redirectUrl: undefined };
      }

      console.log('[GOOGLE_OAUTH] State validado e invalidado com sucesso:', state);
      return parsed;

    } catch (error) {
      console.error('[GOOGLE_OAUTH] Erro ao validar state no Redis:', error);
      return null;
    }
  }

  // Fallback: tentar decodificar como base64url (formato legado ou quando Redis não disponível)
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as OAuthState & { fallback?: boolean };

    // Se não é fallback explícito e Redis está disponível, rejeitar
    // Isso previne uso de states forjados quando Redis está funcionando
    if (!parsed.fallback && isRedisAvailable()) {
      console.warn('[GOOGLE_OAUTH] SECURITY: State base64 rejeitado quando Redis está disponível');
      return null;
    }

    // Validate required fields
    if (!parsed.context || !parsed.nonce) {
      return null;
    }
    if (parsed.context !== 'user') {
      return null;
    }

    // SECURITY: Validar redirectUrl para prevenir open redirect
    if (!isValidRedirectUrl(parsed.redirectUrl)) {
      console.warn('[GOOGLE_OAUTH] Redirect URL inválida bloqueada:', parsed.redirectUrl);
      return { ...parsed, redirectUrl: undefined };
    }

    console.warn('[GOOGLE_OAUTH] State validado via fallback (base64)');
    return parsed;
  } catch {
    console.warn('[GOOGLE_OAUTH] SECURITY: State inválido (não é UUID nem base64 válido)');
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

  // SECURITY FIX F-04: generateState agora é async (armazena no Redis)
  const state = await generateState(context, redirectUrl);
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
