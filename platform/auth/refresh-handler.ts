/**
 * Factory para criar handlers de refresh token
 *
 * Unifica a lógica de refresh entre diferentes tipos de atores (user, admin, etc.)
 * mantendo as especificidades de cada um via configuração.
 *
 * SECURITY: Token Rotation
 * - Valida token atual do cookie
 * - Verifica tokenVersion no Redis (fail-closed)
 * - INCREMENTA tokenVersion (invalidando tokens anteriores)
 * - Gera novo token com novo tokenVersion
 * - Renova TTL da sessão no Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireValidOrigin } from '@/platform/api/csrf';
import { rateLimitByIP } from '@/platform/cache/rate-limit-redis';

// =============================================================================
// Types
// =============================================================================

interface SessionCache<TSession> {
  get(id: string): Promise<TSession | null>;
  set(id: string, data: TSession): Promise<boolean>;
  getTokenVersion(id: string): Promise<number | null>;
  incrementTokenVersion(id: string): Promise<number | null>;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RefreshHandlerConfig<TPayload, TSession> {
  /** Nome do ator para logs (ex: 'user', 'admin', 'collector') */
  actorName: string;

  /** Cache de sessão a ser usado */
  sessionCache: SessionCache<TSession>;

  /** Valores de status considerados ativos (ex: ['active'], ['ACTIVE']) */
  activeStatuses: string[];

  /** Função para extrair o ID do payload */
  getIdFromPayload: (payload: TPayload) => string;

  /** Função para extrair o status da sessão */
  getStatusFromSession: (session: TSession) => string;

  /** Função para obter o token da requisição (pode ser async) */
  getToken: (req: Request) => string | null | Promise<string | null>;

  /** Função para verificar o token JWT - retorna payload e erro */
  verifyToken: (token: string) => Promise<{ payload: TPayload | null; error: string | null }>;

  /** Função para extrair tokenVersion do payload */
  getTokenVersionFromPayload: (payload: TPayload) => number;

  /** Função para assinar novo(s) token(s) - recebe payload e session para acesso a todos os campos */
  signToken: (payload: TPayload, session: TSession, newTokenVersion: number) => Promise<string | { accessToken: string; refreshToken: string }>;

  /** Função para atualizar a sessão com novo tokenVersion */
  updateSession: (session: TSession, newTokenVersion: number) => TSession;

  /** Função para setar cookies de autenticação na resposta */
  setAuthCookies: (response: NextResponse, tokens: string | { accessToken: string; refreshToken: string }) => void;

  /** Função para limpar cookies na resposta */
  clearAuthCookies: (response: NextResponse) => void;

  /** Configuração opcional de rate limit */
  rateLimit?: {
    key: string;
    config: RateLimitConfig;
  };

  /** Função opcional para setar cookies extras (ex: last_activity) */
  setExtraCookies?: (response: NextResponse) => void;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Cria um handler POST para refresh de tokens
 */
export function createRefreshHandler<TPayload, TSession>(
  config: RefreshHandlerConfig<TPayload, TSession>
) {
  return async function POST(request: Request): Promise<NextResponse> {
    try {
      // 1. CSRF Protection
      const csrfError = requireValidOrigin(request as NextRequest);
      if (csrfError) return csrfError;

      // 2. Rate Limiting (opcional)
      if (config.rateLimit) {
        const rateLimitError = await rateLimitByIP(
          request as NextRequest,
          config.rateLimit.key,
          config.rateLimit.config
        );
        if (rateLimitError) return rateLimitError;
      }

      // 3. Obter token do cookie
      const token = await config.getToken(request);

      if (!token) {
        return NextResponse.json(
          { error: 'not_authenticated', message: 'Sessão expirada' },
          { status: 401 }
        );
      }

      // 4. Verificar JWT
      const { payload, error: jwtError } = await config.verifyToken(token);

      if (jwtError || !payload) {
        const response = NextResponse.json(
          {
            error: jwtError || 'invalid_token',
            message: jwtError === 'expired' ? 'Sessão expirada. Faça login novamente.' : 'Sessão inválida'
          },
          { status: 401 }
        );
        config.clearAuthCookies(response);
        return response;
      }

      const actorId = config.getIdFromPayload(payload);
      const payloadTokenVersion = config.getTokenVersionFromPayload(payload);

      // 5. Verificar tokenVersion no Redis (fail-closed)
      const redisTokenVersion = await config.sessionCache.getTokenVersion(actorId);

      if (redisTokenVersion === null) {
        const response = NextResponse.json(
          { error: 'session_expired', message: 'Sessão expirada. Faça login novamente.' },
          { status: 401 }
        );
        config.clearAuthCookies(response);
        return response;
      }

      if (redisTokenVersion !== payloadTokenVersion) {
        const response = NextResponse.json(
          { error: 'token_revoked', message: 'Sessão invalidada. Faça login novamente.' },
          { status: 401 }
        );
        config.clearAuthCookies(response);
        return response;
      }

      // 6. Verificar sessão e status do ator no Redis
      const session = await config.sessionCache.get(actorId);

      if (!session) {
        const response = NextResponse.json(
          { error: 'session_not_found', message: 'Sessão expirada. Faça login novamente.' },
          { status: 401 }
        );
        config.clearAuthCookies(response);
        return response;
      }

      const status = config.getStatusFromSession(session);
      if (!config.activeStatuses.includes(status)) {
        const response = NextResponse.json(
          { error: 'user_inactive', message: 'Conta inativa ou bloqueada' },
          { status: 401 }
        );
        config.clearAuthCookies(response);
        return response;
      }

      // 7. SECURITY: Token Rotation - incrementar tokenVersion
      const newTokenVersion = await config.sessionCache.incrementTokenVersion(actorId);

      if (newTokenVersion === null) {
        return NextResponse.json(
          { error: 'cache_error', message: 'Erro ao renovar sessão. Tente novamente.' },
          { status: 500 }
        );
      }

      // 8. Gerar novo(s) token(s) com NOVO tokenVersion
      const tokens = await config.signToken(payload, session, newTokenVersion);

      // 9. Renovar TTL da sessão no Redis
      const updatedSession = config.updateSession(session, newTokenVersion);
      await config.sessionCache.set(actorId, updatedSession);

      // 10. Criar resposta com novo(s) token(s)
      const response = NextResponse.json({
        message: 'Token renovado com sucesso',
      });

      // 11. Setar cookies de autenticação
      config.setAuthCookies(response, tokens);

      // 12. Setar cookies extras (opcional)
      if (config.setExtraCookies) {
        config.setExtraCookies(response);
      }

      return response;
    } catch (error) {
      console.error(`[${config.actorName.toUpperCase()}_REFRESH] Error:`, error);
      return NextResponse.json(
        { error: 'internal_error', message: 'Erro ao renovar sessão' },
        { status: 500 }
      );
    }
  };
}
