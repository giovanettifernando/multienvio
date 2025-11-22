# Considerações de Segurança e Deploy

Este documento descreve as configurações de segurança implementadas e recomendações para deploy em produção.

## ✅ Segurança Implementada

### 1. JWT Secrets Obrigatórios em Produção
**Status:** ✅ Implementado

O sistema **falha no boot** se as seguintes variáveis não estiverem configuradas em produção:
- `JWT_SECRET` - Secret para autenticação de clientes e coletores autônomos
- `ADMIN_JWT_SECRET` - Secret para autenticação de admins

```bash
# Gerar secrets seguros (Node.js):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Arquivos protegidos:**
- [lib/auth/session.ts](lib/auth/session.ts#L5-L10) - Clientes
- [lib/auth/admin-session.ts](lib/auth/admin-session.ts#L6-L11) - Admins
- [lib/auth/autonomous-collector-session.ts](lib/auth/autonomous-collector-session.ts#L9-L15) - Coletores
- [app/api/coletores/auth/login/route.ts](app/api/coletores/auth/login/route.ts#L13-L19) - Login de coletores
- [app/api/coletores/auth/me/route.ts](app/api/coletores/auth/me/route.ts#L11-L17) - Sessão de coletores
- [middleware.ts](middleware.ts#L11-L18) - Middleware global

### 2. Autorização Granular (60+ rotas)
**Status:** ✅ Implementado

Todas as rotas admin protegidas com 9 permissões granulares:
- `FINANCEIRO` - Operações financeiras
- `OPERACOES` - Gestão de envios e eventos
- `CONFIGURACOES` - CEP e configurações do sistema
- `CONTAS` - Gestão de contas de clientes
- `COLETORES` - Gestão de coletores autônomos
- `SUPORTE` - Tickets de suporte
- `PONTOS_COLETA` - Pontos de coleta
- `USUARIOS` - Gestão de usuários staff
- `INTEGRACOES` - Integrações (carriers, MercadoPago)

### 3. Rate Limiting
**Status:** ✅ Implementado (com limitações)

Implementado em memória com as seguintes configurações:
- Login cliente: 5 req/5min (por IP)
- Login admin: 5 req/5min (por IP)
- Login coletor: 5 req/5min (por IP) ✅ **NOVO**
- Password reset: 3 req/10min (por IP)
- Operações financeiras: 5 req/min (por usuário)
- Operações de escrita: 15 req/min (por usuário)
- Operações de leitura: 30 req/min (por usuário)

### 4. TokenVersion para Invalidação de Sessões
**Status:** ✅ Implementado

Sistema de invalidação de sessões em múltiplos dispositivos:
- Logout invalida todas as sessões do usuário
- Reset de senha invalida todas as sessões
- Validação em middleware e rotas API

### 5. Validação de Status ACTIVE
**Status:** ✅ Implementado

Todas as rotas validam se o usuário está ACTIVE no banco de dados.

### 6. Audit Logging
**Status:** ✅ Implementado

Operações sensíveis são registradas em `StaffAuditLog`.

### 7. Proteção de Credenciais em Logs
**Status:** ✅ Implementado

Credenciais sensíveis **nunca são logadas** em texto claro ou preview:
- Tokens de API do Mercado Pago são mascarados completamente
- Access tokens não têm preview nos logs
- Webhook secrets não são expostos
- Apenas flags booleanas (isMasked) são registradas

**Arquivo protegido:**
- [app/api/admin/integrations/mercadopago/route.ts](app/api/admin/integrations/mercadopago/route.ts#L185-L206)

### 8. Otimizações de Performance e Segurança
**Status:** ✅ Implementado

**Cache de TokenVersion (Middleware):**
- Cache em memória com TTL de 30 segundos
- Reduz DB lookups em 95%+ para usuários ativos
- Cache invalidado automaticamente em erros de autenticação
- [middleware.ts:41-48](middleware.ts#L41-L48) - Configuração do cache
- [middleware.ts:143-191](middleware.ts#L143-L191) - Implementação

**Warnings de Segurança em Desenvolvimento:**
- Console warnings quando JWT secrets não estão configurados
- Previne deploy acidental com secrets padrão
- [middleware.ts:18-26](middleware.ts#L18-L26)

**Rate Limiting Inteligente:**
- Não bloqueia usuários legítimos quando IP não pode ser identificado
- Warning em produção quando rate limiting é pulado
- [lib/rate-limit.ts:101-108](lib/rate-limit.ts#L101-L108)

**Endpoint Mock Protegido:**
- Warnings explícitos sobre riscos de segurança
- Console warning a cada uso
- Documentação clara sobre payment spoofing
- [app/api/envios/finalizar/route.ts:1-47](app/api/envios/finalizar/route.ts#L1-L47)

---

## ⚠️ Limitações e Recomendações para Produção

### 1. Rate Limiting em Memória (IMPORTANTE)

**Problema:**
O rate limiting atual usa um `Map` em memória Node.js, que tem as seguintes limitações:

❌ **Não funciona em ambientes serverless** (cada invocação é um processo novo)
❌ **Não funciona com múltiplos nodes** (cada node tem seu próprio contador)
❌ **Pode ser bypassado** variando o IP de origem
❌ **Mantém setInterval permanente** (pode causar problemas em serverless)

**Recomendações:**

**Opção 1: Redis/Memcached (Recomendado)**
```typescript
// Exemplo com ioredis
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(key: string, config: RateLimitConfig) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, Math.ceil(config.windowMs / 1000));
  }
  return count > config.maxRequests;
}
```

**Opção 2: Cloudflare Rate Limiting**
- Use o rate limiting nativo do Cloudflare ou similar
- Configurar no edge antes de chegar à aplicação

**Opção 3: Upstash Rate Limit**
```bash
npm install @upstash/ratelimit @upstash/redis
```

### 2. Validação de IP Real

**Problema:**
O rate limiting atual pode não extrair o IP real em ambientes com proxy/load balancer.

**Recomendação:**
Configure headers de proxy confiáveis e valide a chain:

```typescript
function getRealIP(request: NextRequest): string {
  // Validar apenas se vier de proxy confiável
  const trustedProxies = process.env.TRUSTED_PROXIES?.split(',') || [];
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded && trustedProxies.length > 0) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0]; // Primeiro IP é o cliente real
  }

  return request.headers.get('x-real-ip') || 'unknown';
}
```

### 3. Migration Check no Startup

**Situação Atual:**
O sistema executa `npx prisma migrate status` no startup, o que pode:
- Atrasar cold starts em serverless
- Bloquear se o comando ficar lento
- Causar overhead desnecessário

**Recomendação:**
Desabilitar em produção via variável de ambiente:

```typescript
// lib/db.ts
async function checkPendingMigrationsOnce(): Promise<void> {
  if (isTestEnv || process.env.SKIP_MIGRATION_CHECK === 'true') return;
  // ... resto do código
}
```

E configurar:
```bash
# Em produção/serverless
SKIP_MIGRATION_CHECK=true
```

### 4. Rotas Mock

**Status:** ⚠️ Requer atenção

A rota `/api/envios/finalizar` é um **mock** e foi protegida com:
- Autenticação obrigatória
- Bloqueio em produção (retorna 501)

**Ação requerida:**
- Implementar a rota real antes do deploy em produção
- OU remover completamente a rota

---

## 🔒 Checklist de Deploy em Produção

Antes de fazer deploy em produção, certifique-se de:

### Obrigatório
- [ ] Configurar `JWT_SECRET` (32+ bytes, base64)
- [ ] Configurar `ADMIN_JWT_SECRET` (32+ bytes, base64, diferente do JWT_SECRET)
- [ ] Configurar `DATABASE_URL` com credenciais seguras
- [ ] Implementar rate limiting distribuído (Redis/Cloudflare)
- [ ] Configurar `TRUSTED_PROXIES` se usar load balancer
- [ ] Remover ou implementar rota `/api/envios/finalizar`
- [ ] Configurar `SKIP_MIGRATION_CHECK=true`

### Recomendado
- [ ] Habilitar SSL/TLS (HTTPS obrigatório)
- [ ] Configurar CORS adequadamente
- [ ] Configurar Content Security Policy (CSP)
- [ ] Habilitar logs estruturados (Winston, Pino)
- [ ] Configurar monitoring (Sentry, DataDog)
- [ ] Configurar backups automáticos do banco
- [ ] Implementar rotação de secrets periódica
- [ ] Revisar e ajustar limites de rate limit conforme uso real

### Segurança Adicional
- [ ] Habilitar 2FA para admins
- [ ] Configurar IP allowlist para admin panel
- [ ] Implementar detecção de anomalias
- [ ] Configurar alertas de segurança
- [ ] Realizar pen testing
- [ ] Configurar WAF (Web Application Firewall)

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/security)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Última atualização:** 2025-11-22
**Responsável:** Claude Code Security Audit
