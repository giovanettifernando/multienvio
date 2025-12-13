/**
 * CSRF Protection Utilities
 *
 * Validação de Origin/Host para prevenir requisições cross-site.
 * Isso é uma camada adicional de proteção além do SameSite=Lax nos cookies.
 *
 * Uso:
 * - validateOrigin(request) - retorna true se Origin é válido ou não presente
 * - requireValidOrigin(request) - retorna NextResponse de erro se Origin inválido
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Extrai o host base de uma URL (sem porta, sem path)
 */
function getHostFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.host.split(':')[0]; // Remove porta se presente
  } catch {
    return null;
  }
}

/**
 * Valida se o Origin header corresponde ao Host esperado.
 *
 * Regras:
 * 1. Se não há Origin header, permite (pode ser requisição same-origin ou não-browser)
 * 2. Se Origin é "null" (como em sandboxed iframes), bloqueia por segurança
 * 3. Se Origin não bate com Host, bloqueia
 *
 * @param request - NextRequest a validar
 * @returns true se válido, false se suspeito de CSRF
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');

  // Sem Origin header - pode ser same-origin ou não-browser client
  // SameSite=Lax nos cookies já protege requisições POST cross-site
  if (!origin) {
    return true;
  }

  // Origin "null" é usado em sandboxed iframes e requisições de file://
  // Por segurança, bloqueamos essas requisições para rotas autenticadas
  if (origin === 'null') {
    return false;
  }

  // Obter host esperado
  const host = request.headers.get('host');
  if (!host) {
    return false;
  }

  // Extrair hostname do Origin
  const originHost = getHostFromUrl(origin);
  if (!originHost) {
    return false;
  }

  // Comparar hosts (sem porta)
  const expectedHost = host.split(':')[0];
  return originHost === expectedHost;
}

/**
 * Middleware helper que retorna erro 403 se Origin for inválido.
 *
 * @param request - NextRequest a validar
 * @returns null se válido, NextResponse com erro 403 se inválido
 */
export function requireValidOrigin(request: NextRequest): NextResponse | null {
  if (validateOrigin(request)) {
    return null;
  }

  console.warn('[CSRF] Origin validation failed', {
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    url: request.url,
  });

  return NextResponse.json(
    { error: 'invalid_origin', message: 'Requisição bloqueada por segurança' },
    { status: 403 }
  );
}
