 RELATÓRIO DE ANÁLISE DE DUPLICIDADES — API ROUTES

  1️⃣ TABELA — INVENTÁRIO DE ROTAS (amostra das principais)

  | Método   | Caminho                                | Arquivo                                            | Domínio          | Auth/Role   | Service             |
  |----------|----------------------------------------|----------------------------------------------------|------------------|-------------|---------------------|
  | POST     | /api/auth/login                        | app/api/auth/login/route.ts                        | User Auth        | Público     | inline              |
  | POST     | /api/admin/auth/login                  | app/api/admin/auth/login/route.ts                  | Admin Auth       | Público     | inline              |
  | POST     | /api/coletores/auth/login              | app/api/coletores/auth/login/route.ts              | Coletor Auth     | Público     | inline              |
  | POST     | /api/pontos-coleta/auth/login          | app/api/pontos-coleta/auth/login/route.ts          | PickupPoint Auth | Público     | inline              |
  | GET      | /api/auth/me                           | app/api/auth/me/route.ts                           | User             | user        | inline              |
  | GET      | /api/admin/auth/me                     | app/api/admin/auth/me/route.ts                     | Admin            | admin       | inline              |
  | GET      | /api/coletores/auth/me                 | app/api/coletores/auth/me/route.ts                 | Coletor          | coletor     | inline              |
  | GET      | /api/pontos-coleta/auth/me             | app/api/pontos-coleta/auth/me/route.ts             | PickupPoint      | pickupPoint | inline              |
  | POST     | /api/auth/refresh                      | app/api/auth/refresh/route.ts                      | User Auth        | user        | inline              |
  | POST     | /api/admin/auth/refresh                | app/api/admin/auth/refresh/route.ts                | Admin Auth       | admin       | inline              |
  | POST     | /api/auth/logout                       | app/api/auth/logout/route.ts                       | User Auth        | user        | inline              |
  | POST     | /api/admin/auth/logout                 | app/api/admin/auth/logout/route.ts                 | Admin Auth       | admin       | inline              |
  | GET      | /api/shipments                         | app/api/shipments/route.ts                         | Shipment         | user        | listUserShipments   |
  | GET      | /api/admin/ops/shipments               | app/api/admin/ops/shipments/route.ts               | Admin Ops        | OPERACOES   | inline              |
  | GET      | /api/wallet/transactions               | app/api/wallet/transactions/route.ts               | Wallet           | user        | getWalletStatement  |
  | GET      | /api/admin/finance/wallet-transactions | app/api/admin/finance/wallet-transactions/route.ts | Admin Finance    | FINANCEIRO  | inline              |
  | GET      | /api/labels                            | app/api/labels/route.ts                            | Labels           | user        | listUserLabels      |
  | GET      | /api/labels/[id]/pdf                   | app/api/labels/[id]/pdf/route.ts                   | Labels           | user        | inline+correios     |
  | GET      | /api/packages/[id]/pdf                 | app/api/packages/[id]/pdf/route.ts                 | Labels           | user        | inline+correios     |
  | GET      | /api/support/tickets                   | app/api/support/tickets/route.ts                   | Support          | user        | listTicketsForUser  |
  | GET      | /api/admin/support/tickets             | app/api/admin/support/tickets/route.ts             | Admin Support    | SUPORTE     | listTicketsForAdmin |
  | GET/POST | /api/account/recipients                | app/api/account/recipients/route.ts                | Recipients       | user        | service             |
  | GET/POST | /api/admin/clients/[id]/recipients     | app/api/admin/clients/[id]/recipients/route.ts     | Admin Recipients | CONTAS      | inline              |
  | POST     | /api/webhooks/mercadopago              | app/api/webhooks/mercadopago/route.ts              | Webhook          | Público     | processWebhook      |
  | POST     | /api/webhooks/tracking                 | app/api/webhooks/tracking/route.ts                 | Webhook          | HMAC        | inline              |

  ---
  2️⃣ TABELA — CANDIDATAS A UNIFICAÇÃO

  | Cluster            | Rotas Envolvidas                                                      | Tipo | O que Duplica                                                                        | Proposta                                      | Risco  | Prioridade |
  |--------------------|-----------------------------------------------------------------------|------|--------------------------------------------------------------------------------------|-----------------------------------------------|--------|------------|
  | AUTH-LOGIN         | 4 rotas de login                                                      | B    | Fluxo: validate→findUser→checkPassword→checkStatus→signToken→setCookie→respond       | Criar createAuthLoginHandler(config) factory  | Baixo  | 🟡 Média   |
  | AUTH-ME            | 4 rotas /auth/me                                                      | B    | Fluxo: getSession→checkActive→returnUser                                             | Criar createAuthMeHandler(config) factory     | Baixo  | 🟡 Média   |
  | AUTH-REFRESH       | /api/auth/refresh + /api/admin/auth/refresh                           | A    | ~80% código idêntico: CSRF→getToken→verify→checkVersion→increment→signNew→setCookies | Criar createRefreshHandler(config) factory    | Médio  | 🟢 Alta    |
  | AUTH-LOGOUT        | 2 rotas logout                                                        | B    | Fluxo: CSRF→getSession→incrementVersion→clearCookies                                 | Unificar em helper                            | Baixo  | 🟢 Alta    |
  | PARSE-ARRAY-PARAM  | support/tickets/route.ts:20-31 + admin/support/tickets/route.ts:9-20  | C    | Função parseArrayParam idêntica                                                      | Extrair para platform/api/params.ts           | Nenhum | 🟢 Alta    |
  | PDF-GENERATOR      | labels/[id]/pdf/route.ts:176-310 + packages/[id]/pdf/route.ts:162-302 | D    | Função createEnvioLegalPdf ~95% idêntica                                             | Extrair para platform/labels/pdf-generator.ts | Nenhum | 🟢 Alta    |
  | PAGINATION-PARSING | ~15 rotas de listagem                                                 | C    | Parsing de page/pageSize/limit com parseInt e fallbacks                              | Criar parsePaginationParams(searchParams)     | Nenhum | 🟢 Alta    |
  | AUTH-CHECK-USER    | Múltiplas rotas user                                                  | C    | getUserFromRequest() + check null + throw 401                                        | Criar requireUserSession(req) wrapper         | Baixo  | 🟡 Média   |
  | AUTH-CHECK-ADMIN   | Múltiplas rotas admin                                                 | C    | getAdminSessionFromRequest() + check null + check permission                         | Usar requireAdminUser() consistentemente      | Baixo  | 🟡 Média   |
  | RECIPIENTS-CRUD    | user vs admin                                                         | B    | Lógica de create/list/update recipients com validação                                | Consolidar service único com flag asAdmin     | Médio  | 🟡 Média   |
  | WEBHOOK-SIGNATURE  | MP + Tracking webhooks                                                | C    | Validação HMAC com timingSafeEqual                                                   | Extrair para platform/api/webhook-auth.ts     | Baixo  | 🟡 Média   |

  ---
  3️⃣ DETALHAMENTO DAS DUPLICIDADES COM EVIDÊNCIAS

  🔴 CLUSTER: AUTH-REFRESH (Tipo A — Duplicidade Funcional)

  Antes: Duas rotas quase idênticas

  app/api/auth/refresh/route.ts (linhas 29-186):
  export const POST = withApiHandlerResponse(async (context) => {
    // CSRF Protection
    const csrfError = requireValidOrigin(req as NextRequest);
    if (csrfError) return csrfError;

    // Rate limiting
    const rateLimitError = await rateLimitByIP(...);

    // Obter refresh token do cookie
    const refreshTokenCookie = cookieStore.get(REFRESH_TOKEN_COOKIE);

    // Verificar refresh token
    const { payload, error } = await verifyRefreshToken(refreshToken, true);

    // Verificar sessão no Redis
    const sessionData = await sessionCache.get(payload.userId);

    // Verificar tokenVersion
    const redisTokenVersion = await sessionCache.getTokenVersion(payload.userId);

    // SECURITY: Token Rotation
    const newTokenVersion = await sessionCache.incrementTokenVersion(payload.userId);

    // Gerar novo par de tokens
    const { accessToken, refreshToken: newRefreshToken } = await signTokenPair({...});

    // Renovar TTL da sessão
    await sessionCache.set(sessionData.userId, {...});

    // Setar novos cookies
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {...});
    response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {...});
  });

  app/api/admin/auth/refresh/route.ts (linhas 28-171):
  export async function POST(request: Request) {
    // CSRF Protection
    const csrfError = requireValidOrigin(request as NextRequest);
    if (csrfError) return csrfError;

    // Obter token admin do cookie
    const token = getAdminTokenFromRequest(request);

    // Verificar JWT
    const { payload, error: jwtError } = await adminVerify(token);

    // Verificar tokenVersion no Redis
    const redisTokenVersion = await staffSessionCache.getTokenVersion(payload.staffId);

    // Verificar sessão
    const session = await staffSessionCache.get(payload.staffId);

    // SECURITY: Token Rotation
    const newTokenVersion = await staffSessionCache.incrementTokenVersion(payload.staffId);

    // Gerar novo token
    const newToken = await adminSign({...});

    // Renovar TTL da sessão
    await staffSessionCache.set(payload.staffId, {...});

    // Setar novo cookie
    response.headers.set('Set-Cookie', createAdminCookieHeader(newToken));
  }

  Proposta: Criar factory createRefreshHandler:
  // platform/auth/refresh-handler.ts
  export function createRefreshHandler<TPayload, TSession>(config: {
    getCookieName: () => string;
    verifyToken: (token: string) => Promise<VerifyResult<TPayload>>;
    sessionCache: SessionCache<TSession>;
    getIdFromPayload: (payload: TPayload) => string;
    signNewToken: (payload: TPayload, tokenVersion: number) => Promise<string>;
    setCookie: (response: NextResponse, token: string) => void;
  }) { ... }

  Risco: Médio — Precisa testar ambos os fluxos de auth.
  Plano de Teste: Unit tests para factory + E2E tests de refresh para user e admin.

  ---
  🔴 CLUSTER: PDF-GENERATOR (Tipo D — Service Duplicado)

  Antes: Função createEnvioLegalPdf duplicada em 2 arquivos

  app/api/labels/[id]/pdf/route.ts:176-310:
  async function createEnvioLegalPdf(
    platformTrackingCode: string,
    correioPdfBuffers: Buffer[]
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const headerHeight = 80;

    // Carregar logo Envio Legal
    let logoImage = null;
    try {
      const logoPath = join(process.cwd(), 'public', 'images', 'envio-legal-logo.png');
      const logoBuffer = await readFile(logoPath);
      logoImage = await pdfDoc.embedPng(logoBuffer);
    } catch { }

    // Gerar código de barras (Code128)
    let barcodeImage = null;
    if (platformTrackingCode) {
      try {
        const barcodePng = await bwipjs.toBuffer({
          bcid: 'code128',
          text: platformTrackingCode,
          scale: 3,
          height: 10,
          includetext: false,
        });
        barcodeImage = await pdfDoc.embedPng(barcodePng);
      } catch { }
    }
    // ... resto do código de embedding
  }

  app/api/packages/[id]/pdf/route.ts:162-302: 95% idêntico, apenas adiciona packageNumber no header.

  Proposta: Extrair para módulo compartilhado:
  // platform/labels/pdf-generator.ts
  export async function createEnvioLegalPdf(options: {
    platformTrackingCode: string;
    correioPdfBuffers: Buffer[];
    packageNumber?: number;  // opcional
  }): Promise<Buffer> { ... }

  Risco: Nenhum — É função pura sem side effects.
  Plano de Teste: Unit test com PDFs mockados.

  ---
  🔴 CLUSTER: PARSE-ARRAY-PARAM (Tipo C — Lógica Repetida)

  Antes: Função idêntica em 2 arquivos

  app/api/support/tickets/route.ts:20-31:
  function parseArrayParam(params: URLSearchParams, key: string): string[] {
    const values = params.getAll(key);
    if (!values.length) {
      const single = params.get(key);
      if (!single) return [];
      values.push(single);
    }
    return values
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
  }

  app/api/admin/support/tickets/route.ts:9-20: Código IDÊNTICO.

  Proposta: Extrair para helper centralizado:
  // platform/api/params.ts
  export function parseArrayParam(params: URLSearchParams, key: string): string[] { ... }
  export function parsePositiveInteger(value: string | null, fallback: number): number { ... }
  export function parsePaginationParams(params: URLSearchParams, defaults?: { page?: number; pageSize?: number }) { ... }

  Risco: Nenhum.
  Plano de Teste: Unit test do helper.

  ---
  4️⃣ PLANO DE REFATORAÇÃO EM FASES

  📗 FASE 1 — Low Risk: Extrair Helpers Comuns (1-2 PRs pequenos)

  | #   | Ação                                                                                          | Arquivos Afetados                       | Testes                    |
  |-----|-----------------------------------------------------------------------------------------------|-----------------------------------------|---------------------------|
  | 1.1 | Criar platform/api/params.ts com parseArrayParam, parsePositiveInteger, parsePaginationParams | ~15 rotas de listagem                   | Unit tests                |
  | 1.2 | Extrair createEnvioLegalPdf para platform/labels/pdf-generator.ts                             | labels/[id]/pdf, packages/[id]/pdf      | Unit test com PDF mockado |
  | 1.3 | Criar platform/api/webhook-auth.ts com validateHmacSignature                                  | webhooks/mercadopago, webhooks/tracking | Unit test                 |

  Passos para 1.1:
  1. Criar platform/api/params.ts
  2. Exportar parseArrayParam, parsePositiveInteger, parsePaginationParams
  3. Atualizar imports em support/tickets/route.ts e admin/support/tickets/route.ts
  4. Remover funções duplicadas dos arquivos de rota
  5. Verificar que testes existentes passam

  ---
  📙 FASE 2 — Medium Risk: Consolidar Services Duplicados (2-3 PRs)

  | #   | Ação                                                                        | Arquivos Afetados                                     | Testes             |
  |-----|-----------------------------------------------------------------------------|-------------------------------------------------------|--------------------|
  | 2.1 | Criar requireUserSession(req) helper que faz getUserFromRequest + throw 401 | ~20 rotas user                                        | Unit + integration |
  | 2.2 | Padronizar uso de requireAdminUser(req, permission) em rotas admin          | ~40 rotas admin                                       | Unit + integration |
  | 2.3 | Unificar recipients service com flag asAdmin                                | account/recipients/*, admin/clients/[id]/recipients/* | E2E                |

  Passos para 2.1:
  // platform/auth/require-session.ts
  export async function requireUserSession(req: Request): Promise<JWTPayload> {
    const session = await getUserFromRequest(req);
    if (!session?.userId) {
      throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
    }
    return session;
  }

  ---
  📕 FASE 3 — Higher Risk: Unificar Rotas/Handlers (PRs maiores)

  | #   | Ação                               | Arquivos Afetados                | Testes                    |
  |-----|------------------------------------|----------------------------------|---------------------------|
  | 3.1 | Criar createRefreshHandler factory | auth/refresh, admin/auth/refresh | E2E para ambos flows      |
  | 3.2 | Criar createLoginHandler factory   | 4 rotas de login                 | E2E para todos os 4 tipos |
  | 3.3 | Criar createAuthMeHandler factory  | 4 rotas /auth/me                 | E2E para todos os 4 tipos |

  Config para Login Factory:
  interface LoginHandlerConfig<TUser, TSession> {
    rateLimitKey: string;
    schema: ZodSchema;
    findUser: (email: string) => Promise<TUser | null>;
    getPasswordHash: (user: TUser) => string | null;
    checkUserActive: (user: TUser) => { ok: boolean; message?: string };
    getSessionPayload: (user: TUser) => TSession;
    sessionCache: SessionCache;
    signTokens: (payload: TSession) => Promise<TokenPair>;
    setCookies: (response: NextResponse, tokens: TokenPair) => void;
    buildResponse: (user: TUser) => object;
  }

  ---
  5️⃣ QUICK WINS (Baixo Risco, Alto Impacto)

  | #    | Mudança                               | LOC Removidas                  | Arquivos |
  |------|---------------------------------------|--------------------------------|----------|
  | ✅ 1 | Extrair parseArrayParam               | ~24                            | 2        |
  | ✅ 2 | Extrair createEnvioLegalPdf           | ~130                           | 2        |
  | ✅ 3 | Criar parsePaginationParams           | ~50 (consolidado de ~15 rotas) | ~15      |
  | ✅ 4 | Padronizar requireUserSession wrapper | ~40 (3 linhas x ~15 rotas)     | ~15      |
  | ✅ 5 | Extrair validateHmacSignature         | ~30                            | 2        |

  ---
  6️⃣ CONVENÇÕES RECOMENDADAS

  Estrutura de Handler Padrão

  1. CSRF check (se POST/PUT/DELETE autenticado)
  2. Rate limiting (se endpoint sensível)
  3. Auth check (via wrapper)
  4. Validação de input (Zod)
  5. Lógica de negócio (via service)
  6. Response padronizada

  Response Envelope (já existe em platform/api/response.ts)

  {
    data: T | null,
    error: { code, message, requestId, details } | null,
    meta: { requestId, path, method, durationMs, timestamp }
  }

  Wrappers de Auth Sugeridos

  // platform/auth/require-session.ts
  requireUserSession(req) → JWTPayload | throws 401
  requireAdminSession(req, permission?) → AdminPayload | throws 401/403
  requireCollectorSession(req) → CollectorPayload | throws 401
  requirePickupPointSession(req) → PickupPointPayload | throws 401

  ---
  7️⃣ PRÓXIMOS PASSOS RECOMENDADOS

  1. Imediato (Quick Wins): Criar PR para Phase 1.1 (params helpers)
  2. Semana 1: Completar Phase 1 (PDF generator, webhook auth)
  3. Semana 2-3: Phase 2 (session wrappers, recipients consolidation)
  4. Futuro: Phase 3 (factories para auth handlers)

  ---

● RESUMO EXECUTIVO

  Duplicidades Críticas Encontradas

  | Prioridade | Cluster                                    | Impacto  | Esforço |
  |------------|--------------------------------------------|----------|---------|
  | 🟢 Alta    | parseArrayParam duplicada                  | ~24 LOC  | 1h      |
  | 🟢 Alta    | createEnvioLegalPdf duplicada              | ~130 LOC | 2h      |
  | 🟢 Alta    | Parsing de paginação repetido em ~15 rotas | ~50 LOC  | 3h      |
  | 🟡 Média   | Auth refresh (user vs admin) ~80% idêntico | ~150 LOC | 4h      |
  | 🟡 Média   | 4 rotas de login com estrutura similar     | ~300 LOC | 6h      |
  | 🟡 Média   | 4 rotas de /auth/me com padrão similar     | ~200 LOC | 4h      |

  O que JÁ está bem feito

  - ✅ withApiHandler e withApiHandlerResponse já são wrappers padronizados
  - ✅ ApiError centralizado com factory methods (badRequest, notFound, etc.)
  - ✅ Response envelope consistente (success, failure, buildMeta)
  - ✅ Services de domínio bem separados (wallet, shipments, labels)

  Recomendação Imediata

  Começar pela Fase 1 (Quick Wins):
  1. Criar platform/api/params.ts → elimina duplicação imediata
  2. Extrair createEnvioLegalPdf → elimina 130 LOC duplicadas
  3. Criar parsePaginationParams → padroniza ~15 rotas

  Essas mudanças são zero-risco e podem ser feitas em PRs pequenos sem impacto no comportamento.


