# Autenticação Real com Prisma + bcrypt

## Visão Geral

Implementação de autenticação real usando PostgreSQL via Prisma ORM, bcrypt para hash de senhas e JWT (jose) para sessões.

## Arquivos Implementados

### 1. Validação ([lib/validation/auth.ts](../lib/validation/auth.ts))
- `LoginSchema`: Validação de email + senha (mínimo 6 caracteres)
- `RegisterSchema`: Validação de nome, email, senha e telefone opcional

### 2. Sessão JWT ([lib/auth/session.ts](../lib/auth/session.ts))
- `sign()`: Assina payload e gera JWT
- `verify()`: Verifica e decodifica JWT
- `createSession()`: Cria token e seta cookie HttpOnly
- `destroySession()`: Remove cookie de autenticação
- `getSession()`: Obtém payload do JWT do cookie
- Cookie: `auth_token` (HttpOnly, Secure em prod, SameSite=Lax, expiração 7 dias)

### 3. Endpoints

#### POST /api/auth/register ([app/api/auth/register/route.ts](../app/api/auth/register/route.ts))
**Request:**
```json
{
  "name": "Nome Completo",
  "email": "usuario@exemplo.com",
  "password": "senha123",
  "phone": "(11) 98765-4321"  // opcional
}
```

**Response (201):**
```json
{
  "userId": "uuid",
  "message": "Usuário criado com sucesso"
}
```

**Comportamento:**
- Verifica se email já existe (409 se duplicado)
- Hash da senha com bcrypt (10 rounds)
- Associa role "user" por padrão
- Auto-login: cria sessão JWT automaticamente
- Nunca expõe passwordHash

#### POST /api/auth/login ([app/api/auth/login/route.ts](../app/api/auth/login/route.ts))
**Request:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "Nome Completo",
    "email": "usuario@exemplo.com",
    "phone": "(11) 98765-4321",
    "status": "active",
    "roles": ["admin"],  // ou [] para user comum
    "lastLoginAt": "2025-10-30T12:00:00.000Z",
    "createdAt": "2025-10-30T10:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z"
  },
  "message": "Login realizado com sucesso"
}
```

**Comportamento:**
- Busca usuário por email
- Compara senha com bcrypt.compare()
- Verifica status (deve ser "active")
- Atualiza lastLoginAt
- Cria sessão JWT + cookie
- Mensagem genérica em 401 (não revela se email existe)

#### GET /api/auth/me ([app/api/auth/me/route.ts](../app/api/auth/me/route.ts))
**Headers:** Cookie com `auth_token`

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "Nome Completo",
    "email": "usuario@exemplo.com",
    "phone": "(11) 98765-4321",
    "status": "active",
    "roles": ["admin"],
    "lastLoginAt": "2025-10-30T12:00:00.000Z",
    "createdAt": "2025-10-30T10:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z"
  }
}
```

**Comportamento:**
- Lê e valida JWT do cookie
- Busca usuário no Prisma
- Retorna 401 se não autenticado
- Retorna 403 se conta não está ativa

#### POST /api/auth/logout ([app/api/auth/logout/route.ts](../app/api/auth/logout/route.ts))
**Response (200):**
```json
{
  "message": "Logout realizado com sucesso"
}
```

**Comportamento:**
- Remove cookie `auth_token` (maxAge=0)

## Segurança

✅ Senha hasheada com bcrypt (10 rounds)
✅ JWT com HS256 (jose)
✅ Cookie HttpOnly (não acessível via JavaScript)
✅ Cookie Secure em produção
✅ SameSite=Lax (proteção CSRF)
✅ passwordHash nunca exposto nas responses
✅ Mensagem genérica em 401 (não revela se email existe)
✅ Validação com Zod (422 para dados inválidos)
✅ Verificação de status do usuário

## Tipos Globais

Os endpoints retornam o tipo `User` do contrato global ([types/contracts.ts](../types/contracts.ts)):

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;  // "active" | "blocked" | "pending"
  roles: AuthRole[];   // ["admin"] ou []
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Testes via curl

### 1. Registrar novo usuário
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"testuser@example.com","password":"test123","phone":"(11) 98765-4321"}' \
  -c /tmp/cookies.txt
```

**Esperado:** 201 com `{ userId, message }` + cookie setado

### 2. Verificar sessão após registro
```bash
curl http://localhost:3000/api/auth/me -b /tmp/cookies.txt
```

**Esperado:** 200 com objeto `{ user }` (auto-login funcionou)

### 3. Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout -b /tmp/cookies.txt -c /tmp/cookies.txt
```

**Esperado:** 200 com `{ message }`

### 4. Verificar que sessão foi removida
```bash
curl http://localhost:3000/api/auth/me -b /tmp/cookies.txt
```

**Esperado:** 401 com `{ message: "Não autenticado" }`

### 5. Login com usuário seeded
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@enviolegal.com","password":"admin123"}' \
  -c /tmp/cookies.txt
```

**Esperado:** 200 com `{ user, message }` onde user.roles = ["admin"]

### 6. Verificar role admin
```bash
curl http://localhost:3000/api/auth/me -b /tmp/cookies.txt
```

**Esperado:** 200 com user.roles = ["admin"]

### 7. Teste de senha inválida
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@enviolegal.com","password":"wrongpass"}'
```

**Esperado:** 401 com `{ message: "E-mail ou senha inválidos" }`

### 8. Teste de email duplicado
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Another","email":"admin@enviolegal.com","password":"test123"}'
```

**Esperado:** 409 com `{ message: "E-mail já cadastrado" }`

## Status dos Testes

✅ Registro de novo usuário (201)
✅ Auto-login após registro
✅ /me retorna usuário autenticado (200)
✅ Logout remove sessão (200)
✅ /me retorna 401 após logout
✅ Login com admin@enviolegal.com (200)
✅ Admin tem role "admin" no array
✅ Senha inválida retorna 401
✅ Email duplicado retorna 409

## Configuração

### Variável de Ambiente

Adicionar ao `.env.local`:

```bash
# JWT Secret (mudar em produção!)
JWT_SECRET=envio-legal-secret-key-change-in-production
```

⚠️ **IMPORTANTE**: Usar uma chave segura e aleatória em produção!

Gerar chave segura:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Credenciais de Teste (Seed)

- **Admin**: admin@enviolegal.com / admin123
- **User**: user@enviolegal.com / user123

## Próximos Passos

1. ✅ Autenticação real implementada
2. 🔲 Adaptar páginas frontend ([app/(auth)/auth/login/page.tsx](../app/(auth)/auth/login/page.tsx), etc) para usar novos endpoints
3. 🔲 Migrar outros endpoints mock para Prisma
4. 🔲 Implementar refresh token (opcional)
5. 🔲 Adicionar rate-limiting (express-rate-limit ou similar)
6. 🔲 Implementar recuperação de senha
7. 🔲 Adicionar 2FA (opcional)

## Compatibilidade

✅ Tipos globais do [types/contracts.ts](../types/contracts.ts)
✅ Zustand store existente ([stores/auth.ts](../stores/auth.ts))
✅ Guards e hooks ([components/auth/AdminGuard.tsx](../components/auth/AdminGuard.tsx), [hooks/useCurrentUser.ts](../hooks/useCurrentUser.ts))
✅ PostgreSQL via Prisma
✅ Next.js 15 App Router
✅ TypeScript com validação estrita
