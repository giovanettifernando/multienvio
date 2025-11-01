# Sistema de Invalidação de Sessões (Token Version)

Documentação do sistema de controle de versão de tokens para invalidação global de sessões.

## Índice

- [Visão Geral](#visão-geral)
- [Como Funciona](#como-funciona)
- [Casos de Uso](#casos-de-uso)
- [Implementação](#implementação)
- [Política de Cookies](#política-de-cookies)
- [Fluxo de Alteração de Senha](#fluxo-de-alteração-de-senha)
- [Testes](#testes)

---

## Visão Geral

O sistema de `tokenVersion` permite invalidar todas as sessões ativas de um usuário de forma instantânea, sem necessidade de manter uma blacklist de tokens ou esperar que os JWTs expirem naturalmente.

### Problema que Resolve

- **Alteração de senha**: Todas as sessões anteriores devem ser invalidadas imediatamente
- **Comprometimento de conta**: Revogar acesso de todos os dispositivos
- **Logout global**: Permitir que o usuário faça logout de todos os dispositivos
- **Segurança**: Prevenir uso de tokens roubados após mudança de credenciais

---

## Como Funciona

### 1. Campo `tokenVersion` no Banco de Dados

```sql
-- Adicionado à tabela users
tokenVersion INTEGER NOT NULL DEFAULT 0
```

- **Valor inicial**: 0 (quando o usuário é criado)
- **Incremento**: +1 a cada evento de segurança (alteração de senha, logout global, etc.)
- **Armazenado**: No JWT como claim `tokenVersion`

### 2. Geração de Token (Login)

Quando o usuário faz login:

```typescript
// 1. Buscar usuário do banco (SEMPRE do banco, nunca cache)
const user = await prisma.user.findUnique({
  where: { email },
  select: { id, email, tokenVersion, passwordHash, ... }
});

// 2. Criar JWT com tokenVersion
const token = await createSession({
  userId: user.id,
  email: user.email,
  role: user.role,
  tokenVersion: user.tokenVersion, // ← Incluído no token
});
```

### 3. Validação de Token

A cada requisição que requer autenticação:

```typescript
// 1. Decodificar JWT
const payload = await verify(token, true); // ← true = validar tokenVersion

// 2. Buscar tokenVersion atual do banco
const user = await prisma.user.findUnique({
  where: { id: payload.userId },
  select: { tokenVersion: true }
});

// 3. Comparar versões
if (user.tokenVersion !== payload.tokenVersion) {
  // Token inválido - sessão foi revogada
  return null;
}

// 4. Token válido
return payload;
```

### 4. Invalidação de Sessões

Ao alterar a senha (ou outro evento de segurança):

```typescript
// Incrementar tokenVersion
await prisma.user.update({
  where: { id: userId },
  data: {
    passwordHash: newHash,
    tokenVersion: user.tokenVersion + 1, // ← Invalida todos os tokens antigos
  }
});
```

**Resultado**: Todos os tokens com `tokenVersion` anterior se tornam inválidos instantaneamente.

---

## Casos de Uso

### 1. Alteração de Senha

**Fluxo**:
1. Usuário altera senha
2. `tokenVersion` incrementado de `N` para `N+1`
3. Token atual tem `tokenVersion: N` → **inválido**
4. Cookies removidos
5. Usuário deve fazer login novamente com nova senha
6. Novo token gerado com `tokenVersion: N+1` → **válido**

### 2. Logout Global

```typescript
// Endpoint: POST /api/account/security/logout-all
await prisma.user.update({
  where: { id: userId },
  data: {
    tokenVersion: user.tokenVersion + 1
  }
});
```

**Resultado**: Todas as sessões em todos os dispositivos são invalidadas.

### 3. Comprometimento de Conta

Se detectado acesso não autorizado:
- Admin ou sistema incrementa `tokenVersion`
- Todas as sessões (inclusive do atacante) são invalidadas
- Usuário legítimo deve redefinir senha e fazer login novamente

### 4. Múltiplas Sessões

**Cenário**: Usuário logado em 2 dispositivos

- Dispositivo A: Token com `tokenVersion: 5`
- Dispositivo B: Token com `tokenVersion: 5`

Usuário altera senha no Dispositivo A:
- `tokenVersion` → 6
- Dispositivo A: Token antigo (v5) inválido → redireciona para login → novo token (v6)
- Dispositivo B: Token (v5) inválido → ao fazer próxima requisição, é deslogado

---

## Implementação

### Estrutura do JWT

```json
{
  "userId": "clxxx...",
  "email": "user@example.com",
  "role": "user",
  "tokenVersion": 5,
  "iat": 1698765432,
  "exp": 1699370232
}
```

### Middleware de Autenticação

```typescript
export async function getUserFromRequest(request: Request): Promise<JWTPayload | null> {
  // 1. Extrair token do cookie
  const token = extractTokenFromCookie(request);
  if (!token) return null;

  // 2. Verificar JWT E validar tokenVersion
  const payload = await verify(token, true);
  if (!payload) return null;

  // 3. Se tokenVersion não bate, sessão inválida
  return payload;
}
```

### Funções Auxiliares

```typescript
// lib/auth/session.ts

// Verificar token COM validação de tokenVersion
export async function verify(token: string, validateTokenVersion: boolean = false) {
  const payload = await jwtVerify(token, JWT_SECRET);

  if (validateTokenVersion && payload.userId) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true }
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return null; // Token inválido
    }
  }

  return payload;
}
```

---

## Política de Cookies

### Session-Only por Padrão

**Comportamento**: Cookies sem `Max-Age` → fecha ao fechar o navegador

```typescript
setAuthCookie(token, rememberMe: false); // Session-only
```

### "Lembrar de Mim"

**Comportamento**: Cookie com `Max-Age=7d` → persiste após fechar navegador

```typescript
setAuthCookie(token, rememberMe: true); // Expira em 7 dias
```

### Configuração de Cookies

```typescript
{
  httpOnly: true,        // Não acessível via JavaScript
  secure: true,          // HTTPS only (produção)
  sameSite: 'lax',       // Proteção contra CSRF
  path: '/',             // Disponível em todas as rotas
  maxAge: undefined      // Session-only (ou 7d se rememberMe)
}
```

---

## Fluxo de Alteração de Senha

### Diagrama de Sequência

```
Usuário              Frontend          API           Banco           Sessões
  |                     |               |              |               |
  |--- POST change-password ----------->|              |               |
  |                     |               |              |               |
  |                     |         [1. Validar senha atual]             |
  |                     |               |              |               |
  |                     |         [2. Hash nova senha]                 |
  |                     |               |              |               |
  |                     |               |--UPDATE----->|               |
  |                     |               |  tokenVersion+1              |
  |                     |               |<--OK---------|               |
  |                     |               |              |               |
  |                     |               |--CLEAR COOKIES-------------->|
  |                     |               |              |               |
  |                     |<--200 OK------|              |               |
  |                     |  requireReauth: true         |               |
  |                     |               |              |               |
  |--REDIRECT /login----|               |              |               |
  |                     |               |              |               |
```

### Passo a Passo

1. **Usuário envia senha atual e nova senha**
   ```json
   POST /api/account/security/change-password
   {
     "currentPassword": "OldP@ss123",
     "newPassword": "NewP@ss456!",
     "confirmPassword": "NewP@ss456!"
   }
   ```

2. **API valida e atualiza**
   - Verifica senha atual
   - Valida política de nova senha
   - Hash da nova senha
   - **Incrementa `tokenVersion`**
   - Atualiza `passwordHash` e `passwordUpdatedAt`

3. **API remove cookies**
   ```typescript
   response.cookies.set(AUTH_COOKIE_NAME, "", {
     maxAge: 0 // Expira imediatamente
   });
   ```

4. **API retorna sucesso**
   ```json
   {
     "ok": true,
     "sessionInvalidated": true,
     "requireReauth": true
   }
   ```

5. **Frontend redireciona para login**
   ```typescript
   if (response.requireReauth) {
     router.push('/auth/login');
   }
   ```

6. **Outras sessões são invalidadas**
   - Na próxima requisição, `tokenVersion` não bate
   - `verify()` retorna `null`
   - Middleware redireciona para `/auth/login`

---

## Testes

### Teste A: Alteração de Senha Básica

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"OldPass123!"}' \
  -c cookies.txt

# 2. Alterar senha
curl -X POST http://localhost:3000/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword":"OldPass123!",
    "newPassword":"NewPass456!",
    "confirmPassword":"NewPass456!"
  }'

# Esperado: { "ok": true, "requireReauth": true }
# Cookies devem estar limpos

# 3. Tentar acessar recurso protegido
curl http://localhost:3000/api/account/me -b cookies.txt

# Esperado: 401 Unauthorized

# 4. Login com senha ANTIGA
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"OldPass123!"}'

# Esperado: 401 "E-mail ou senha inválidos"

# 5. Login com senha NOVA
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"NewPass456!"}' \
  -c cookies2.txt

# Esperado: 200 OK, novo token nos cookies
```

### Teste B: Múltiplas Sessões

```bash
# 1. Login no Navegador A
# tokenVersion = 5
# Token A criado

# 2. Login no Navegador B
# tokenVersion = 5
# Token B criado

# 3. Alterar senha no Navegador A
# tokenVersion = 6
# Token A (v5) invalidado → novo token (v6) criado

# 4. Navegador B faz requisição
# Token B (v5) não bate com tokenVersion (6)
# Sessão inválida → redirect para login
```

### Teste C: Persistência de Sessão

```bash
# Sem "lembrar de mim"
# - Cookie de sessão (sem Max-Age)
# - Fechar navegador → sessão perdida

# Com "lembrar de mim"
# - Cookie com Max-Age=7d
# - Fechar e reabrir navegador → sessão mantida
# - Após alteração de senha → sessão invalidada mesmo com Max-Age
```

---

## Verificação no Banco de Dados

```sql
-- Ver tokenVersion de um usuário
SELECT id, email, "tokenVersion", "passwordUpdatedAt"
FROM users
WHERE email = 'user@example.com';

-- Ver tokens ativos (JWT decodificado)
-- Nota: JWTs são stateless, não ficam no banco
-- Mas podemos ver o tokenVersion vigente:
SELECT email, "tokenVersion"
FROM users
WHERE "tokenVersion" > 0;
```

---

## Perguntas Frequentes

### 1. E se alguém roubar o JWT antes da alteração de senha?

**R**: O token roubado se torna inválido assim que o `tokenVersion` é incrementado. Na próxima validação, `verify()` retorna `null`.

### 2. O que acontece se o banco de dados cair?

**R**: A validação de `tokenVersion` requer acesso ao banco. Se o banco estiver indisponível, todas as requisições autenticadas falharão (503 Service Unavailable).

### 3. Há overhead de performance?

**R**: Sim, cada validação de token faz uma query ao banco (`SELECT tokenVersion FROM users WHERE id = ?`).
- **Mitigação**: Usar cache Redis com TTL curto (ex: 5 minutos)
- **Trade-off**: Segurança vs Performance

### 4. Posso ter sessões permanentes e temporárias ao mesmo tempo?

**R**: Sim! Basta usar `rememberMe` no login:
```typescript
createSession(payload, rememberMe: true); // 7 dias
createSession(payload, rememberMe: false); // Session-only
```

### 5. Como implementar "Ver Sessões Ativas"?

**Resposta**: Atualmente, não temos tabela `Session`. Para implementar:
1. Criar tabela `sessions` com `userId`, `token`, `ip`, `userAgent`, `createdAt`
2. Armazenar sessões ao fazer login
3. Permitir revogar sessão individual (sem incrementar `tokenVersion`)

---

## Referências

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Cookie Security Flags](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

---

## Suporte

Para dúvidas ou problemas relacionados ao sistema de tokenVersion:

- **Documentação Geral**: `/docs/AUTH.md`
- **Alteração de Senha**: `/docs/API_ACCOUNT_SECURITY.md`
- **Repositório**: `github.com/enviolegal/enviolegal-api`
