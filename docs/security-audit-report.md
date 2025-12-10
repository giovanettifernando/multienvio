# Security Audit Report — Envio Legal

## Resumo executivo
- Escopo: Next.js/Node/Prisma/Postgres monorepo. Foco em AppSec, bypasses e código legado.
- Comandos executados: `npm audit --production` (0 vulnerabilidades); buscas `rg` para TODO/HACK/mocks, console logs, eval/child_process, Prisma raw, cookies/JWT.
- Principais riscos: uso de segredos JWT padrão/hardcoded em rotas de reset/OAuth, rate limit fail-open com fallback local, uso de rótulos/etiquetas mock em emissão de PDF de remessa pós-pagamento.

## Vulnerabilidades e achados

### 1) Segredos JWT hardcoded como fallback (High)
- **Onde:** `app/api/admin/pickup-points/[id]/reset-password/route.ts` (`process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'`), `app/api/admin/coletores/[id]/reset-password/route.ts` (mesmo fallback), `app/api/auth/google/callback/route.ts` (`'|| 'your-secret-key-change-this-in-production'`).
- **Risco:** Em produção sem `JWT_SECRET` forte, tokens de reset e cookies de sessão de coletores/OAuth podem ser forjados com segredo público, permitindo takeover de contas/links de redefinição.
- **Exploração:** Atacante conhece o fallback, gera JWT válido para reset ou login e executa sem interação do usuário.
- **Recomendação:** Tornar obrigatório `JWT_SECRET`/`ADMIN_JWT_SECRET` sem fallback; falhar no boot se ausente; rotacionar tokens emitidos com chave fraca; adicionar alertas de observabilidade.

### 2) Rate limit fail-open com fallback local não distribuído (Medium)
- **Onde:** `lib/rate-limit-redis.ts` (estratégia “FAIL-OPEN”; se Redis indisponível, usa mapa em memória por instância).
- **Risco:** Queda/timeout do Redis remove proteção de brute force e scraping em ambiente multi-nó; limite local não compartilha contadores e pode ser facilmente contornado ao atacar durante falhas de Redis ou roteando entre pods.
- **Exploração:** Atacante força/ou aguarda indisponibilidade de Redis e dispara tentativas de login massivas sem bloqueio centralizado.
- **Recomendação:** Preferir fail-closed para rotas sensíveis (login/reset/financeiro); circuit breaker curto com backoff; healthcheck/alerta para Redis; opção de recusar tráfego sensível quando sem Redis.

### 3) Etiquetas mock persistem em fluxo de débito da carteira (Medium)
- **Onde:** `app/api/wallet/debit/route.ts` (usa `mockPdfBase64` para `label.updateMany` ao marcar remessas pagas).
- **Risco:** Após pagamento via carteira, etiquetas emite PDF estático fictício; pode permitir impressão inválida, contestação de envio e fraude operacional; ausência de prova de postagem real.
- **Exploração:** Usuário gera pagamentos e recebe etiqueta falsa sem integração ao carrier.
- **Recomendação:** Bloquear emissão até integração real ou marcar estado “pendente”; remover PDF mock em produção; guardar feature flag explícita e auditável.

### 4) Verbose logging com dados sensíveis (Low/Info)
- **Onde (exemplos):** `components/(...)FinalizarClient.tsx`, `lib/email/mailer.ts`, hooks `usePickupFee`, `useQuotes`, `useAccount`, pagamentos (`usePixPayment`, `CheckoutCartModal`), etc. (`rg console.log/error/warn` retornou >100 ocorrências).
- **Risco:** Logs de payloads completos podem incluir PII (endereços, documentos, e-mail) e dados de pagamento em clientes/servidor; risco de exposição em consoles compartilhados ou Sentry se hookado.
- **Recomendação:** Remover/mascarar logs em produção; usar logger estruturado com redaction; ESLint regra já sinalizada na base.

### 5) Uso de `queryRawUnsafe` em serviço PostGIS (Low)
- **Onde:** `lib/services/postgis.ts` (consultas com `$1/$2` usando `$queryRawUnsafe`).
- **Risco:** CEP é normalizado para dígitos, reduzindo superfície, mas `queryRawUnsafe` ignora escaping automático; se normalização falhar, risco de SQL injection.
- **Recomendação:** Migrar para `prisma.$queryRaw` taggeado ou `Prisma.sql`; manter validação estrita de CEP.

## Categorias x Status
- **Autenticação / sessão / cookies:** Falta hard fail para JWT secret (High). Cookies usam `httpOnly`, `secure` em prod.
- **Autorização:** Rotas de reset exigem sessão/permissão; sem achados de bypass.
- **Validação / sanitização:** Zod presente em auth; sem raw body sem validação detectado nesta amostra.
- **CSRF/CORS/headers/cache:** Não avaliado em detalhe; rotas Next API geralmente são same-site; revisar se rotas GET mutáveis existem.
- **Injeção (SQL/command):** `queryRawUnsafe` em PostGIS (Low); `execFile` apenas interno para migrate status.
- **SSRF/command:** Não identificado.
- **File handling / path traversal / open redirect:** Etiqueta mock (Medium) em fluxo de arquivos; sem path traversal visto.
- **Exposição de dados sensíveis:** Logs verbosos (Low).
- **Rate limit/brute force:** Fail-open (Medium).
- **Dependências vulneráveis:** `npm audit --production` → 0 vulnerabilidades.
- **Mocks / bypass:** JWT secret fallback (High); label PDF mock (Medium); múltiplos “mock_*” logs em rotas admin (sem efeito direto, mas indica rotas simuladas).
- **Código deprecated/obsoleto:** Não mapeado completo; ver plano de limpeza.

## Riscos exploráveis
- JWT fallback permite **account takeover** via password reset / OAuth (alto impacto, probabilidade alta se variável ausente).
- Rate limit fail-open permite **brute force de login** durante falhas de Redis (impacto médio, dependente de disponibilidade).
- Etiqueta mock permite **fraude operacional** (impacto médio para logística/financeiro).

## Itens suspeitos (avaliar)
- Consultas `$queryRawUnsafe` em `lib/services/postgis.ts` — hoje sanitizado por normalização, mas manter vigilância.
- Muitos logs de debug de pagamento/checkout contendo payloads completos — revisar redaction antes de enviar a observabilidade.

## Evidências (referências de código)
```
17:19:app/api/admin/pickup-points/[id]/reset-password/route.ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'
);

15:17:app/api/admin/coletores/[id]/reset-password/route.ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'
);

22:25:app/api/auth/google/callback/route.ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

155:184:lib/rate-limit-redis.ts
// FAIL-OPEN: Redis falhou, abre circuit breaker e usa fallback local
return checkLocalRateLimit(key, config);

169:211:app/api/wallet/debit/route.ts
const mockPdfBase64 = 'JVBERi0xLjQKJeLjz9M...';
await tx.label.updateMany({ ..., fileBase64: mockPdfBase64, ... });

204:213:lib/services/postgis.ts
const result = await prisma.$queryRawUnsafe<{ distance_m: number }[]>(`
  SELECT ST_Distance(... WHERE a.cep = $1 AND b.cep = $2
`, a, b);
```

## Prioridade de correção
1. Remover fallbacks de `JWT_SECRET` e invalidar/rotacionar tokens emitidos com chave fraca.
2. Endurecer rate limiting para rotas sensíveis (fail-closed ou grace period curto; alertas para Redis).
3. Retirar PDF mock e bloquear emissão até integração real ou feature flag segura.
4. Remover/redigir logs com PII e migrar para logger estruturado.
5. Migrar consultas `queryRawUnsafe` para variantes parametrizadas.

## Notas adicionais
- `npm audit --production` retornou **0 vulnerabilidades**.
- Buscas de TODO/HACK/mock mostraram vários marcadores “mock_*” em rotas admin; avaliar se rotas estão em uso real antes de produção.

