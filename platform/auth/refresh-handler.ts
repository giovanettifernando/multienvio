/**
 * Factory para criar handlers de refresh token
 *
 * Unifica a lógica de refresh entre diferentes tipos de atores (user, admin, etc.)
 * mantendo as especificidades de cada um via configuração.
 *
 * - Valida token atual do cookie
 * - Verifica tokenVersion no Redis (fail-closed): versão nova = sessão revogada
 *   (bloqueio, troca de permissão), derruba todos os aparelhos
 * - Verifica que o aparelho (sid) ainda está logado
 * - Gera token novo com a MESMA versão e o mesmo aparelho e renova a validade
 *
 * A renovação não incrementa o tokenVersion: incrementar invalidava a sessão
 * de todos os outros aparelhos e abas do usuário a cada página aberta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireValidOrigin } from '@/platform/api/csrf';
import { rateLimitByIP } from '@/platform/cache/rate-limit-redis';

// =============================================================================
// Types
// =============================================================================

interface SessionCache<TSession> {
  get(id: string): Promise<TSession | null>;
  getTokenVersion(id: string): Promise<number | null>;
  openDevice(id: string): Promise<string>;
  touchDevice(id: string, sid: string): Promise<boolean>;
  touch(id: string): Promise<boolean>;
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

  /** Aparelho do token (tokens de antes da sessão por aparelho não têm) */
  getSidFromPayload: (payload: TPayload) => string | undefined;

  /** Função para assinar novo(s) token(s) - recebe payload e session para acesso a todos os campos */
  signToken: (payload: TPayload, session: TSession, tokenVersion: number, sid: string) => Promise<string | { accessToken: string; refreshToken: string }>;

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

      // 7. Aparelho ainda logado? (logout neste aparelho encerra só ele)
      let sid = config.getSidFromPayload(payload);
      if (sid) {
        const aberto = await config.sessionCache.touchDevice(actorId, sid);
        if (!aberto) {
          const response = NextResponse.json(
            { error: 'session_closed', message: 'Sessão encerrada. Faça login novamente.' },
            { status: 401 }
          );
          config.clearAuthCookies(response);
          return response;
        }
      } else {
        // Token de antes da sessão por aparelho: ganha um aparelho agora
        sid = await config.sessionCache.openDevice(actorId);
      }

      // 8. Token novo com a mesma versão e o mesmo aparelho
      const tokens = await config.signToken(payload, session, redisTokenVersion, sid);

      // 9. Renovar a validade da sessão (sem regravar a versão, para não
      // desfazer um bloqueio feito no meio desta renovação)
      await config.sessionCache.touch(actorId);

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
