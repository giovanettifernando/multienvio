# Implementação de "Esqueci minha senha"

## Resumo

Implementação completa do fluxo de reset de senha por e-mail, seguindo as melhores práticas de segurança.

## Alterações Realizadas

### 1. Database Schema (Prisma)

#### Novo Modelo: `PasswordResetToken`

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique // Hash SHA-256 do token (nunca armazenar token em claro)
  expiresAt DateTime  // Token expira em 1 hora
  usedAt    DateTime? // Marca quando o token foi utilizado (uso único)
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([tokenHash])
  @@map("password_reset_tokens")
}
```

**Características:**
- Tokens armazenados como hash SHA-256 (nunca em texto claro)
- Expiração de 1 hora
- Uso único (campo `usedAt`)
- Índices para performance
- Cascade delete quando usuário é removido

#### Atualização do Modelo `User`

Adicionada relação com `PasswordResetToken`:

```prisma
model User {
  // ... outros campos
  passwordResetTokens PasswordResetToken[]
}
```

### 2. Backend - API Routes

#### POST `/api/auth/forgot-password`

**Arquivo:** `app/api/auth/forgot-password/route.ts`

**Funcionalidades:**
- Validação de e-mail com Zod (`ForgotPasswordSchema`)
- Geração de token aleatório (32 bytes = 256 bits)
- Hash do token com SHA-256 para armazenamento seguro
- Expiração: 1 hora
- Envio de e-mail com link de reset
- **Sempre retorna sucesso** (não revela se o e-mail existe)

**Fluxo:**
1. Valida e-mail
2. Busca usuário no banco
3. Se não existe → retorna mensagem genérica de sucesso (segurança)
4. Se existe:
   - Gera token aleatório
   - Hash do token com SHA-256
   - Salva na tabela `password_reset_tokens`
   - Envia e-mail com link: `{BASE_URL}/auth/reset-password?token={token}`
5. Sempre retorna 200 com mensagem genérica

**Exemplo de Resposta:**
```json
{
  "message": "Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha."
}
```

#### POST `/api/auth/reset-password`

**Arquivo:** `app/api/auth/reset-password/route.ts`

**Funcionalidades:**
- Validação de token e nova senha com Zod (`ResetPasswordSchema`)
- Verificação de token válido, não expirado, não utilizado
- Hash de senha com bcrypt (12 salt rounds)
- **Incremento de `tokenVersion`** → invalida todas as sessões anteriores
- Atualização de `passwordUpdatedAt`
- Marca token como usado (`usedAt`)
- Transaction para garantir atomicidade

**Fluxo:**
1. Valida payload (token + nova senha)
2. Hash do token com SHA-256
3. Busca token no banco
4. Verificações:
   - Token existe?
   - Não foi usado (`usedAt` é null)?
   - Não expirou (`expiresAt > now`)?
5. Se válido:
   - Hash da nova senha (bcrypt, 12 rounds)
   - **Atualiza usuário:**
     - `passwordHash`
     - `passwordUpdatedAt`
     - `tokenVersion` (incrementa +1)
   - **Marca token como usado**
6. Retorna sucesso

**Exemplo de Resposta:**
```json
{
  "message": "Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.",
  "success": true
}
```

**Códigos de Erro:**
- 400: Token inválido, expirado ou já utilizado
- 422: Validação falhou (senha não atende requisitos)
- 500: Erro interno

### 3. Frontend - Páginas

#### `/auth/forgot-password`

**Arquivo:** `app/(auth)/auth/forgot-password/page.tsx`

**Características:**
- Form com campo de e-mail
- Validação client-side com Zod
- Mensagem de sucesso genérica (não revela se e-mail existe)
- Link para voltar ao login
- Opção de reenviar

**UI/UX:**
- Título: "Redefinir senha"
- Mensagem de sucesso: "Se o email estiver cadastrado, você receberá as instruções..."
- Link: "Voltar ao login"

#### `/auth/reset-password`

**Arquivo:** `app/(auth)/auth/reset-password/page.tsx`

**Características:**
- Recebe token via query parameter (`?token=...`)
- Form com campo de nova senha
- Validação client-side com Zod
- Mostra requisitos de senha
- Redirecionamento automático para login após sucesso (2 segundos)
- Tratamento de erros específicos (token inválido, expirado, usado)

**UI/UX:**
- Título: "Definir nova senha"
- Requisitos de senha visíveis
- Mensagens de erro específicas
- Redirecionamento para `/auth/login` após sucesso

### 4. E-mail Template

**Arquivo:** `lib/email/mailer.ts`

**Função:** `sendPasswordResetEmail(to, name, resetUrl)`

**Template HTML:**
- Design responsivo (tabelas HTML)
- Botão de ação: "Redefinir Senha"
- Link alternativo (copiar/colar)
- Aviso de expiração (1 hora)
- Aviso de segurança (se não solicitou, ignore)
- Footer com copyright

**Exemplo:**
```
Assunto: Redefinir senha - Envio Legal

Olá, {nome}!

Recebemos uma solicitação para redefinir a senha da sua conta.

[Botão: Redefinir Senha]

ℹ Link válido por 1 hora

⚠ Você não solicitou esta alteração?
Se você não solicitou a redefinição de senha, ignore este email.
```

### 5. Páginas de Login

#### `/login/page.tsx`

**Alterações:**
- ❌ **Removido:** Banner de usuários de teste
  ```tsx
  // REMOVIDO:
  <Typography.Paragraph>
    Usuários de teste: demo@enviolegal.com / demo123 ou admin@enviolegal.com / admin123
  </Typography.Paragraph>
  ```
- ✅ **Adicionado:** Link "Esqueci minha senha"
  ```tsx
  <Link href="/auth/forgot-password">
    Esqueci minha senha
  </Link>
  ```

#### `/auth/login/page.tsx`

**Alterações:**
- ✅ **Atualizado:** Link "Esqueci minha senha" de `/auth/esqueci-senha` para `/auth/forgot-password`

## Segurança

### Tokens

1. **Geração:**
   - `crypto.randomBytes(32)` → 32 bytes = 256 bits de entropia
   - Hex encoding → 64 caracteres hexadecimais

2. **Armazenamento:**
   - Nunca armazena token em claro
   - SHA-256 hash antes de salvar no banco
   - Comparação via hash (mesmo princípio de passwords)

3. **Expiração:**
   - 1 hora após criação
   - Verificado no momento do uso

4. **Uso Único:**
   - Campo `usedAt` marca quando foi utilizado
   - Reuso bloqueado mesmo dentro da validade

### Sessões

1. **Invalidação Global:**
   - Campo `tokenVersion` no usuário
   - Incrementado ao resetar senha
   - JWTs antigos rejeitados (tokenVersion mismatch)

2. **Efeito:**
   - Usuário deslogado de todos os dispositivos
   - Força novo login com senha nova

### Privacidade

1. **Não Revela Informação:**
   - Sempre retorna mensagem genérica em `/forgot-password`
   - Impede enumeração de e-mails cadastrados

2. **Rate Limiting:**
   - Endpoint implementado sem rate limiting explícito
   - ⚠️ **Recomendação:** Adicionar rate limiting (ex: 3 tentativas / 15 min por IP)

## Fluxo Completo

### 1. Usuário Esqueceu a Senha

```
1. Acessa /auth/login
2. Clica "Esqueci minha senha"
3. Redirecionado para /auth/forgot-password
4. Informa e-mail
5. Clica "Enviar link de redefinição"
6. Mensagem de sucesso (genérica)
```

### 2. Backend Processa

```
1. Valida e-mail
2. Busca usuário no banco
3. Se encontrado:
   a. Gera token aleatório (32 bytes)
   b. Hash SHA-256 do token
   c. Salva na tabela password_reset_tokens
   d. Envia e-mail com link
4. Retorna 200 (sempre)
```

### 3. Usuário Recebe E-mail

```
1. Abre e-mail
2. Clica no link: /auth/reset-password?token=...
3. Redirecionado para página de reset
```

### 4. Usuário Define Nova Senha

```
1. Preenche nova senha (atendendo requisitos)
2. Clica "Atualizar senha"
3. Backend valida token e atualiza senha
4. tokenVersion incrementado (sessões invalidadas)
5. Mensagem de sucesso
6. Redirecionamento automático para /auth/login (2 segundos)
```

### 5. Usuário Faz Login

```
1. Acessa /auth/login
2. Informa e-mail e NOVA senha
3. Login bem-sucedido
```

## Testes

### QA Manual

1. **Solicitar Reset com E-mail Válido:**
   ```bash
   POST /api/auth/forgot-password
   Body: { "email": "usuario@example.com" }

   Esperado:
   - 200 OK
   - Mensagem genérica
   - E-mail enviado
   ```

2. **Solicitar Reset com E-mail Inválido:**
   ```bash
   POST /api/auth/forgot-password
   Body: { "email": "naoexiste@example.com" }

   Esperado:
   - 200 OK
   - Mesma mensagem genérica
   - Nenhum e-mail enviado
   ```

3. **Resetar Senha com Token Válido:**
   ```bash
   POST /api/auth/reset-password
   Body: {
     "token": "<token-do-email>",
     "password": "NovaSenha123!"
   }

   Esperado:
   - 200 OK
   - success: true
   - Senha atualizada
   - tokenVersion incrementado
   ```

4. **Reusar Token:**
   ```bash
   POST /api/auth/reset-password
   Body: { "token": "<mesmo-token>", "password": "Outra123!" }

   Esperado:
   - 400 Bad Request
   - Erro: "Este link já foi utilizado"
   ```

5. **Token Expirado:**
   - Aguardar >1 hora após geração
   ```bash
   POST /api/auth/reset-password
   Body: { "token": "<token-expirado>", "password": "Nova123!" }

   Esperado:
   - 400 Bad Request
   - Erro: "Token de redefinição expirado"
   ```

6. **Verificar Banner de Teste Removido:**
   - Acessar `/login`
   - Verificar que NÃO aparece: "Usuários de teste: demo@enviolegal.com / demo123..."
   - Verificar que aparece link: "Esqueci minha senha"

## Arquivos Modificados

### Database
- `prisma/schema.prisma` - Novo modelo PasswordResetToken

### Backend
- `app/api/auth/forgot-password/route.ts` - Atualizado para usar novo modelo
- `app/api/auth/reset-password/route.ts` - Atualizado com tokenVersion e novo modelo
- `lib/email/mailer.ts` - Nova função sendPasswordResetEmail

### Frontend
- `app/(auth)/auth/forgot-password/page.tsx` - Nova página
- `app/(auth)/auth/reset-password/page.tsx` - Nova página
- `app/login/page.tsx` - Removido banner, adicionado link
- `app/(auth)/auth/login/page.tsx` - Atualizado link

## Melhorias Futuras

1. **Rate Limiting:**
   - Adicionar rate limiting em `/api/auth/forgot-password`
   - Sugestão: 3 tentativas / 15 min por IP

2. **Auditoria:**
   - Log de tentativas de reset (sucesso e falha)
   - Integração com `UserSecurityEvent`

3. **Notificação de Tentativa:**
   - Enviar e-mail mesmo se conta não existir (sem revelar)
   - Aviso de tentativa de reset para e-mails cadastrados

4. **Limpeza de Tokens:**
   - Job/cron para deletar tokens expirados
   - Evitar crescimento infinito da tabela

5. **2FA:**
   - Solicitar código 2FA além do e-mail
   - Camada extra de segurança

## Build Status

✅ Build passou sem erros
✅ Apenas warnings pré-existentes (não relacionados a esta feature)

## Migration

Para aplicar as mudanças do banco de dados:

```bash
# Desenvolvimento
DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma db push

# Produção (após testar)
DATABASE_URL="postgresql://user:pass@host:5432/db" npx prisma migrate deploy
```

## Conclusão

Implementação completa do fluxo "Esqueci minha senha" com:
- ✅ Segurança robusta (tokens hashed, uso único, expiração)
- ✅ Privacidade (não revela se e-mail existe)
- ✅ UX clara (mensagens, redirecionamentos)
- ✅ Invalidação de sessões (tokenVersion)
- ✅ E-mails HTML responsivos
- ✅ Banner de teste removido
- ✅ Build passou sem erros

Pronto para deploy após testes manuais.
