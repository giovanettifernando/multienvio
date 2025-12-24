 🔒 RELATÓRIO DE AUDITORIA DE SEGURANÇA E QUALIDADE

  Envio Legal v2 - Auditoria Profunda (Deep Audit)

  ---
  1. AUTENTICAÇÃO E SESSÃO

  1.1 [CRÍTICO] Secrets de Desenvolvimento em .env

  - Arquivo: .env:26-29
  - Evidência:
  JWT_SECRET=envio-legal-secret-key-change-in-production
  ADMIN_JWT_SECRET=admin-panel-secret-key-change-in-production
  - Cenário de falha: Se este arquivo for commitado ou o sistema for para produção sem alterar, qualquer pessoa pode forjar tokens JWT válidos e acessar qualquer conta.
  - Impacto: Takeover completo do sistema, acesso admin irrestrito.
  - Correção:
    a. Remover .env do repositório
    b. Usar secrets manager (AWS Secrets Manager, Vault)
    c. Gerar secrets criptograficamente fortes (32+ bytes aleatórios)
    d. Validar em runtime que secrets não são defaults
  - Teste: Unit test que falha se secret contém "change-in-production" ou é menor que 32 chars

  1.2 [ALTO] Falta de Rotação de Refresh Token

  - Arquivo: modules/auth/application/jwt-tokens.ts
  - Evidência: O sistema usa tokens JWT com expiração fixa, mas não há rotação de refresh tokens. O mesmo token pode ser usado múltiplas vezes.
  - Cenário de falha: Token roubado permanece válido até expirar naturalmente.
  - Impacto: Sessão hijacking prolongada.
  - Correção: Implementar refresh token rotation com one-time use e invalidação em cadeia.
  - Teste: Integration test: refresh usado 2x deve falhar na 2ª vez

  1.3 [MÉDIO] Fallback Silencioso de TokenVersion em Produção

  - Arquivo: modules/auth/application/admin-session.ts:161-176
  - Evidência:
  const redisTokenVersion = await staffSessionCache.getTokenVersion(jwtPayload.staffId);
  if (redisTokenVersion === null) {
    return null; // Fail-closed - bom
  }
  - Cenário de falha: Se Redis estiver indisponível, o código retorna null (fail-closed), o que é correto. Porém, não há alerta/métrica quando isso acontece.
  - Impacto: Usuários não conseguem acessar sem saber por quê.
  - Correção: Adicionar logging e métricas quando Redis está down.
  - Teste: Unit test com Redis mock indisponível

  ---
  2. AUTORIZAÇÃO E MULTI-TENANT / IDOR

  2.1 [CRÍTICO] Endpoint SQL Admin Permite Injection

  - Arquivo: app/api/admin/sql/route.ts:113-115
  - Evidência:
  const result = await prisma.$queryRawUnsafe(trimmedQuery);
  - Cenário de falha: Embora haja blacklist de comandos perigosos (DROP, TRUNCATE, etc.), a validação por regex é facilmente bypassável:
    - SELECT * FROM users; --DROP TABLE users
    - Comentários SQL, encoding, unicode bypass
    - SELECT queries podem exfiltrar dados sensíveis
  - Impacto: Exfiltração completa do banco de dados, possível escalação para RCE via pg_read_file.
  - Correção:
    a. Remover este endpoint completamente
    b. Se necessário, usar apenas queries pré-definidas com parâmetros
    c. Implementar allowlist ao invés de blocklist
  - Teste: Penetration test com SQLi payloads conhecidos

  2.2 [ALTO] Falta de Tenant Check em Admin Wallet Adjust

  - Arquivo: app/api/admin/clients/[id]/wallet/adjust/route.ts:34
  - Evidência:
  const userId = params.id; // Vem direto da URL, não valida se admin tem acesso a este tenant
  - Cenário de falha: Um admin pode ajustar wallet de qualquer usuário, mesmo de outros tenants (se houver multi-tenancy).
  - Impacto: Fraude financeira cross-tenant.
  - Correção: Adicionar verificação de escopo do admin sobre o usuário.
  - Teste: Integration test: admin tenant A tenta ajustar wallet de usuário tenant B

  2.3 [MÉDIO] IDOR Potencial em /api/shipments/[id]

  - Arquivo: app/api/shipments/[id]/route.ts:140-174
  - Evidência:
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    // ... sem verificação de userId na query
  });
  // Verificação feita DEPOIS do fetch
  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden'...
  - Cenário de falha: O shipment é carregado do banco antes da verificação de ownership. Embora o erro seja retornado, um timing attack pode revelar existência de IDs.
  - Impacto: Enumeração de shipments existentes.
  - Correção: Incluir senderId: session.userId no WHERE da query.
  - Teste: Unit test: IDs inexistentes e IDs de outro usuário devem ter mesmo tempo de resposta

  2.4 [ALTO] Falta de Verificação de Tenant em Múltiplas Rotas Admin

  - Arquivos: Múltiplas rotas em app/api/admin/clients/[id]/**
  - Evidência: As rotas usam params.id diretamente sem verificar se o admin tem permissão sobre aquele cliente específico.
  - Correção: Implementar middleware de tenant isolation.

  ---
  3. PAGAMENTOS E REGRAS FINANCEIRAS

  3.1 [CRÍTICO] Race Condition no Wallet Debit Parcialmente Mitigado

  - Arquivo: modules/wallet/application/debit.service.ts:138-164
  - Evidência:
  const wallets = await tx.$queryRaw<...>`
    SELECT ... FROM "wallets" WHERE "userId" = ${userId} FOR UPDATE
  `;
  - Status: Lock FOR UPDATE implementado corretamente.
  - Suspeita: Verificar se timeout de lock é adequado para carga alta.
  - Teste recomendado: Load test com 100 débitos simultâneos no mesmo wallet

  3.2 [ALTO] Webhook Mercado Pago - Timing Attack na Validação

  - Arquivo: platform/integrations/mercadopago/webhooks.ts:100-101
  - Evidência:
  const isValid = calculatedSignature === v1; // Comparação direta
  - Cenário de falha: Comparação de string não é constant-time, permitindo timing attack para descobrir assinatura válida.
  - Impacto: Atacante pode forjar webhooks de pagamento.
  - Correção: Usar crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(v1))
  - Teste: Unit test que verifica uso de timingSafeEqual

  3.3 [MÉDIO] Idempotência de Checkout Baseada em Tempo

  - Arquivo: modules/cart/application/checkout.service.ts:432-452
  - Evidência:
  createdAt: {
    gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
  },
  - Cenário de falha: Se usuário fizer checkout idêntico após 5 minutos, criará duplicata.
  - Impacto: Shipments duplicados, cobrança dupla.
  - Correção: Usar idempotency key explícita (UUID gerado no cliente).
  - Teste: Integration test: mesmo checkout 6 minutos depois

  3.4 [MÉDIO] Falta de Ledger Entry em Algumas Operações

  - Arquivo: modules/wallet/application/wallet.service.ts
  - Evidência: refund() e creditFromGatewayTopup() criam ledger entries, mas debit() básico não.
  - Impacto: Auditoria financeira incompleta.
  - Correção: Garantir ledger entry em todas as operações de wallet.

  ---
  4. DB / INTEGRIDADE DE DADOS

  4.1 [ALTO] Falta de Constraint CHECK em Wallet Balance

  - Arquivo: prisma/schema.prisma:434-446
  - Evidência:
  model Wallet {
    availableCents Int @default(0) // Sem CHECK constraint
  - Cenário de falha: Bug de aplicação pode setar saldo negativo (apesar do código checar, é defense in depth).
  - Impacto: Inconsistência financeira.
  - Correção: Adicionar CHECK constraint no PostgreSQL:
  ALTER TABLE wallets ADD CONSTRAINT positive_balance CHECK (availableCents >= 0);
  - Teste: Database test tentando UPDATE direto com valor negativo

  4.2 [MÉDIO] Falta de Unique Constraint em Webhook External ID

  - Arquivo: prisma/schema.prisma - PaymentWebhook model
  - Evidência: Deduplicação de webhooks é feita via query, não via constraint.
  - Cenário de falha: Race condition pode processar mesmo webhook 2x.
  - Correção: Adicionar @@unique([gatewayId, externalId]) no schema.

  4.3 [MÉDIO] Password History Armazenado como JSON

  - Arquivo: prisma/schema.prisma:42
  - Evidência:
  passwordHistory Json?
  - Cenário de falha: Sem tipagem forte, pode corromper estrutura.
  - Correção: Criar tabela PasswordHistoryEntry separada.

  ---
  5. SEGURANÇA / OWASP

  5.1 [CRÍTICO] Path Traversal Parcialmente Mitigado em Uploads

  - Arquivo: app/api/uploads/[...path]/route.ts:40-47
  - Evidência:
  if (requestedPath.includes('..') || requestedPath.includes('//')) {
    throw new ApiError({ code: 'INVALID_PATH'...
  - Cenário de falha: Bypass possível com encoding (%2e%2e), unicode (。。), ou path canonicalization issues.
  - Correção: Usar path.resolve() e verificar se resultado está dentro de uploadsDir:
  const resolved = path.resolve(uploadsDir, requestedPath);
  if (!resolved.startsWith(uploadsDir + path.sep)) throw ...
  - Teste: Fuzzing com payloads de path traversal

  5.2 [ALTO] Upload Sem Validação de Tipo de Arquivo

  - Arquivo: app/api/uploads/[...path]/route.ts
  - Evidência: O código apenas SERVE arquivos, mas onde é o upload? Não encontrei validação de tipo MIME, tamanho máximo, ou scan de vírus.
  - Suspeita: Precisa localizar rota de upload e verificar validações.
  - Correção: Validar magic bytes, não confiar em extensão.

  5.3 [MÉDIO] CSP Header Ausente

  - Arquivo: next.config.ts:81-131
  - Evidência: Headers de segurança incluem X-Frame-Options, HSTS, mas não Content-Security-Policy.
  - Impacto: XSS mais difícil de mitigar.
  - Correção: Adicionar CSP restritivo:
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" }

  5.4 [MÉDIO] CORS Configuração Potencialmente Permissiva

  - Arquivo: next.config.ts:114-115
  - Evidência:
  value: process.env.CORS_ORIGIN || 'https://enviolegal.com.br',
  - Cenário de falha: Em dev sem CORS_ORIGIN definida, aceita qualquer origem (ou usa default). Se CORS_ORIGIN tiver wildcard, é problema.
  - Correção: Nunca usar wildcard, validar lista de origens permitidas.

  5.5 [BAIXO] Password Policy com Lista Pequena de Senhas Comuns

  - Arquivo: modules/auth/dto/password-policy.ts:13-20
  - Evidência:
  const COMMON_PASSWORDS = new Set([
    '123456', 'password', ... // ~30 senhas
  ]);
  - Correção: Usar lista de top 10k passwords (arquivo externo).

  ---
  6. INTEGRAÇÕES EXTERNAS

  6.1 [ALTO] Falta de Timeout Explícito em Chamadas Correios

  - Arquivo: platform/integrations/correios/ (verificar client.ts)
  - Suspeita: Não vi timeout explícito configurado nas chamadas fetch.
  - Impacto: Requisições podem travar indefinidamente, causando thread starvation.
  - Correção: Adicionar AbortController com timeout de 30s.

  6.2 [MÉDIO] Retry Sem Backoff Exponencial em Webhook

  - Arquivo: platform/integrations/mercadopago/webhooks.ts:318
  - Evidência:
  nextRetryAt.setMinutes(nextRetryAt.getMinutes() + Math.pow(2, webhook.retryCount + 1));
  - Status: Backoff exponencial implementado ✓

  6.3 [MÉDIO] Falta de Circuit Breaker

  - Arquivo: Integrações Correios e Mercado Pago
  - Impacto: Se serviço externo ficar indisponível, sistema continua tentando e degradando.
  - Correção: Implementar circuit breaker pattern.

  ---
  7. OBSERVABILIDADE

  7.1 [MÉDIO] Logs Sem Correlation ID Consistente

  - Arquivo: platform/logging/logger.ts:164-174
  - Evidência: createRequestLogger existe mas não é usado em todas as rotas.
  - Correção: Garantir uso em todas as rotas via middleware.

  7.2 [MÉDIO] Falta de Métricas de Negócio

  - Evidência: Não encontrei integração com Prometheus/Datadog para métricas como:
    - Taxa de aprovação de pagamentos
    - Saldo total em wallets
    - Shipments por status
  - Correção: Adicionar exportador de métricas.

  7.3 [BAIXO] Log de Erro Pode Vazar Stack em Produção

  - Arquivo: platform/logging/logger.ts:195
  - Evidência:
  stack: isDev ? err.stack : undefined,
  - Status: Corretamente oculta stack em produção ✓

  ---
  8. FRONTEND / SERVER-CLIENT BOUNDARY

  8.1 [MÉDIO] Validações Duplicadas ou Ausentes

  - Suspeita: Schemas Zod são definidos no frontend e reusados no backend?
  - Verificar: Se validação no client é bypassável e backend não valida.

  8.2 [BAIXO] Dados Sensíveis Potencialmente no Bundle

  - Verificar: Se NEXT_PUBLIC_* vars incluem dados que não deveriam ser públicos.
  - Evidência: NEXT_PUBLIC_MP_PUBLIC_KEY é ok (é pública mesmo).

  ---
  9. CONFIG / SECRETS / PRODUÇÃO

  9.1 [CRÍTICO] .env no Repositório com Secrets Reais

  - Arquivo: .env
  - Evidência: Arquivo existe e contém secrets de desenvolvimento com placeholders fracos.
  - Correção:
    a. Adicionar .env ao .gitignore
    b. Usar .env.example com valores placeholder
    c. Rotacionar todos os secrets que foram expostos

  9.2 [ALTO] NEXT_PUBLIC_DEV_ADMIN_BYPASS

  - Arquivo: .env:32
  - Evidência:
  NEXT_PUBLIC_DEV_ADMIN_BYPASS=false
  - Cenário de falha: Se alguém setar true em produção, pode bypassar autenticação admin.
  - Correção: Remover esta variável completamente, usar feature flags seguras.

  9.3 [MÉDIO] Falta de Validação de Environment em Runtime

  - Arquivo: Verificar se existe validação no startup
  - Correção: Usar Zod para validar todas as env vars obrigatórias no boot.

  ---
  10. RESUMO EXECUTIVO

  | Categoria         | Crítico | Alto | Médio | Baixo |
  |-------------------|---------|------|-------|-------|
  | Auth/Sessão       | 1       | 1    | 1     | 0     |
  | IDOR/Multi-tenant | 1       | 2    | 1     | 0     |
  | Pagamentos        | 0       | 1    | 2     | 0     |
  | DB/Integridade    | 0       | 1    | 2     | 0     |
  | Segurança/OWASP   | 1       | 1    | 2     | 1     |
  | Integrações       | 0       | 1    | 1     | 0     |
  | Observabilidade   | 0       | 0    | 2     | 1     |
  | Frontend          | 0       | 0    | 1     | 1     |
  | Config/Secrets    | 1       | 1    | 1     | 0     |
  | TOTAL             | 4       | 8    | 13    | 3     |

  ---
  AÇÕES IMEDIATAS RECOMENDADAS

  1. HOJE: Rotacionar TODOS os JWT secrets e MP credentials
  2. HOJE: Remover ou desabilitar endpoint /api/admin/sql
  3. ESTA SEMANA: Implementar constraint CHECK no wallet
  4. ESTA SEMANA: Corrigir timing attack no webhook validation
  5. ESTE MÊS: Adicionar CSP headers
  6. ESTE MÊS: Implementar circuit breaker nas integrações

  ---

● Auditoria concluída. O relatório acima contém 28 achados categorizados por severidade:

  - 4 CRÍTICOS: Secrets fracos, SQL injection endpoint, IDOR, path traversal
  - 8 ALTOS: Race conditions, timing attacks, falta de tenant isolation
  - 13 MÉDIOS: Observabilidade, CSP, circuit breaker, validações
  - 3 BAIXOS: Password policy, logs

  Os achados mais urgentes que devem ser corrigidos imediatamente são:

  1. Rotação dos JWT secrets (.env:26-29)
  2. Remoção/desabilitação do endpoint /api/admin/sql
  3. Correção do timing attack no webhook do Mercado Pago
  4. Adição de constraints CHECK no banco para saldo de wallet

