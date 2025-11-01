# API de Segurança da Conta

Documentação dos endpoints de segurança da conta do usuário.

## Índice

- [Alterar Senha](#alterar-senha)
- [Política de Senha](#política-de-senha)
- [Rate Limiting](#rate-limiting)
- [Auditoria](#auditoria)
- [Códigos de Erro](#códigos-de-erro)

---

## Alterar Senha

Endpoint para alteração de senha do usuário autenticado.

### Endpoint

```
POST /api/account/security/change-password
```

### Autenticação

Requer autenticação via cookie `httpOnly` (mesmo fluxo de `/api/account/me`).

### Request Body

```json
{
  "currentPassword": "string",
  "newPassword": "string",
  "confirmPassword": "string"
}
```

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `currentPassword` | string | Sim | Senha atual do usuário (1-256 caracteres) |
| `newPassword` | string | Sim | Nova senha (deve atender à [política de senha](#política-de-senha)) |
| `confirmPassword` | string | Sim | Confirmação da nova senha (deve ser igual a `newPassword`) |

### Validações

1. **currentPassword**: Obrigatório, mínimo 1 caractere, máximo 256 caracteres
2. **newPassword**: Deve atender à política de senha (ver [Política de Senha](#política-de-senha))
3. **confirmPassword**: Deve ser idêntico a `newPassword`
4. **Senha diferente**: `newPassword` não pode ser igual a `currentPassword`
5. **Verificação**: `currentPassword` deve corresponder à senha atual no banco
6. **Histórico**: `newPassword` não pode ser uma das últimas 5 senhas utilizadas (se `preventReuse` ativado)

### Response - Sucesso (200)

```json
{
  "ok": true,
  "sessionInvalidated": true,
  "requireReauth": true
}
```

#### Campos de Resposta

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ok` | boolean | Sempre `true` em caso de sucesso |
| `sessionInvalidated` | boolean | Indica se as sessões anteriores foram invalidadas |
| `requireReauth` | boolean | Indica que o frontend deve redirecionar para login |

**IMPORTANTE**: Os cookies de autenticação são automaticamente removidos no response. O frontend deve redirecionar para `/auth/login` ao receber `requireReauth: true`.

### Response - Erro

Formato padrão de erro:

```json
{
  "ok": false,
  "code": "error_code",
  "message": "Mensagem descritiva do erro",
  "details": {}  // Opcional
}
```

### Efeitos Colaterais

#### 1. Invalidação de Sessões (Token Version)

Ao alterar a senha, **todas as sessões anteriores do usuário são invalidadas instantaneamente** usando o sistema de `tokenVersion`:

1. O campo `tokenVersion` do usuário é incrementado no banco de dados
2. Todos os JWTs antigos (com `tokenVersion` anterior) se tornam inválidos
3. Na próxima requisição autenticada, tokens antigos são rejeitados
4. O usuário precisa fazer login novamente em TODOS os dispositivos

**Como funciona**:
- Cada JWT contém o `tokenVersion` vigente no momento da criação
- A validação compara `tokenVersion` do JWT com o do banco
- Se não coincidirem, o token é rejeitado (sessão invalidada)

Ver mais detalhes em [AUTH_TOKEN_VERSION.md](./AUTH_TOKEN_VERSION.md)

#### 2. Auditoria

Um evento de segurança `PASSWORD_CHANGED` é registrado na tabela `user_security_events` com:
- `userId`: ID do usuário
- `type`: "PASSWORD_CHANGED"
- `ip`: Endereço IP do cliente
- `userAgent`: User-Agent do navegador
- `createdAt`: Data/hora do evento

#### 3. E-mail de Notificação

Um e-mail de notificação é enviado para o endereço cadastrado informando:
- Data e hora da alteração
- IP e dispositivo (quando disponíveis)
- Link para configurações de segurança
- Aviso sobre comprometimento da conta

**Nota**: O envio de e-mail é assíncrono e não bloqueia a resposta. Falhas no envio não afetam o sucesso da operação.

#### 4. Atualização de Campos

Os seguintes campos são atualizados no banco de dados:
- `passwordHash`: Novo hash da senha (bcrypt, 12 rounds)
- `passwordUpdatedAt`: Data/hora da alteração
- `passwordHistory`: Array com os últimos N hashes (para prevenir reutilização)
- `updatedAt`: Atualizado automaticamente

---

## Política de Senha

A política de senha define os requisitos mínimos de segurança para senhas de usuários.

### Requisitos

| Requisito | Valor | Descrição |
|-----------|-------|-----------|
| **Comprimento mínimo** | 8 caracteres | Mínimo de 8 caracteres |
| **Comprimento máximo** | 256 caracteres | Máximo de 256 caracteres |
| **Letra maiúscula** | Obrigatório | Pelo menos 1 letra maiúscula (A-Z) |
| **Letra minúscula** | Obrigatório | Pelo menos 1 letra minúscula (a-z) |
| **Número** | Obrigatório | Pelo menos 1 número (0-9) |
| **Caractere especial** | Obrigatório | Pelo menos 1 caractere especial (!@#$%^&*...) |
| **Senhas comuns** | Bloqueado | Senhas muito comuns são rejeitadas |
| **Reutilização** | Bloqueado | Últimas 5 senhas não podem ser reutilizadas |

### Caracteres Especiais Permitidos

```
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ?
```

### Exemplos

#### Senhas Válidas ✅

- `MyP@ssw0rd!`
- `S3nh@F0rt3!`
- `Tr0c@rS3nh@2024`

#### Senhas Inválidas ❌

- `password` (muito comum, sem maiúscula, sem número, sem especial)
- `12345678` (muito comum, sem letras)
- `Password` (sem número, sem caractere especial)
- `password1` (sem maiúscula, sem caractere especial)
- `PASSWORD1!` (sem minúscula)

### Mensagens de Erro de Política

Quando a senha não atende à política, o erro `password_policy_failed` retorna com detalhes:

```json
{
  "ok": false,
  "code": "password_policy_failed",
  "message": "A senha não atende aos requisitos de segurança",
  "details": {
    "errors": [
      "A senha deve ter no mínimo 8 caracteres",
      "A senha deve conter pelo menos uma letra maiúscula",
      "A senha deve conter pelo menos um número"
    ]
  }
}
```

---

## Rate Limiting

Para prevenir ataques de força bruta, o endpoint de alteração de senha possui rate limiting em dois níveis:

### 1. Por Endereço IP

- **Limite**: 5 requisições
- **Janela**: 15 minutos
- **Chave**: `change-password:ip:{ip}`

### 2. Por Usuário

- **Limite**: 3 requisições
- **Janela**: 15 minutos
- **Chave**: `change-password:user:{userId}`

### Comportamento

Quando o limite é excedido, o endpoint retorna:

```json
{
  "ok": false,
  "code": "too_many_attempts",
  "message": "Muitas tentativas. Tente novamente em alguns minutos."
}
```

**Status HTTP**: `429 Too Many Requests`

### Implementação

O rate limiting é implementado usando armazenamento em memória (desenvolvimento) ou Redis (produção recomendado).

---

## Auditoria

Todos os eventos de segurança relacionados à alteração de senha são registrados para auditoria.

### Tabela: `user_security_events`

```sql
CREATE TABLE "user_security_events" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Tipos de Eventos

| Tipo | Descrição |
|------|-----------|
| `PASSWORD_CHANGED` | Senha alterada com sucesso |
| `PASSWORD_RESET` | Senha redefinida via token |
| `LOGIN_FAILED` | Tentativa de login falhada |
| `SESSION_INVALIDATED` | Sessão invalidada manualmente |

### Evento: `PASSWORD_CHANGED`

Exemplo de registro:

```json
{
  "id": "clxxx...",
  "userId": "clyyyy...",
  "type": "PASSWORD_CHANGED",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "metadata": {
    "previousPasswordUpdatedAt": "exists"
  },
  "createdAt": "2025-11-01T12:00:00.000Z"
}
```

### Evento: `LOGIN_FAILED` (senha incorreta)

Quando o usuário erra a senha atual:

```json
{
  "id": "clzzz...",
  "userId": "clyyyy...",
  "type": "LOGIN_FAILED",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "metadata": {
    "reason": "invalid_current_password"
  },
  "createdAt": "2025-11-01T12:00:00.000Z"
}
```

---

## Códigos de Erro

### Tabela de Códigos

| Código | Status HTTP | Descrição |
|--------|-------------|-----------|
| `unauthorized` | 401 | Usuário não autenticado |
| `invalid_payload` | 400 | Payload JSON inválido ou campos faltando |
| `current_password_incorrect` | 400 | Senha atual está incorreta |
| `password_policy_failed` | 400 | Nova senha não atende à política de segurança |
| `password_unchanged` | 400 | Nova senha é igual à senha atual |
| `password_reused` | 400 | Nova senha foi utilizada recentemente |
| `password_not_set` | 400 | Conta sem senha definida (OAuth) |
| `too_many_attempts` | 429 | Limite de requisições excedido (rate limit) |
| `service_unavailable` | 503 | Serviço temporariamente indisponível (DB down) |
| `internal_error` | 500 | Erro interno do servidor |

### Detalhamento dos Erros

#### `unauthorized` (401)

Usuário não está autenticado. Cookie de sessão ausente ou inválido.

```json
{
  "ok": false,
  "code": "unauthorized",
  "message": "Não autenticado"
}
```

#### `invalid_payload` (400)

Payload JSON inválido ou validação Zod falhou.

```json
{
  "ok": false,
  "code": "invalid_payload",
  "message": "As senhas não conferem",
  "errors": [
    {
      "field": "confirmPassword",
      "message": "As senhas não conferem"
    }
  ]
}
```

#### `current_password_incorrect` (400)

A senha atual fornecida não corresponde à senha no banco de dados.

```json
{
  "ok": false,
  "code": "current_password_incorrect",
  "message": "Senha atual incorreta"
}
```

**Nota**: Por segurança, não informamos se o usuário existe ou não. Sempre retornamos a mesma mensagem.

#### `password_policy_failed` (400)

A nova senha não atende aos requisitos da política de senha.

```json
{
  "ok": false,
  "code": "password_policy_failed",
  "message": "A senha não atende aos requisitos de segurança",
  "details": {
    "errors": [
      "A senha deve ter no mínimo 8 caracteres",
      "A senha deve conter pelo menos uma letra maiúscula"
    ]
  }
}
```

#### `password_unchanged` (400)

A nova senha é idêntica à senha atual.

```json
{
  "ok": false,
  "code": "password_unchanged",
  "message": "A nova senha deve ser diferente da senha atual"
}
```

#### `password_reused` (400)

A nova senha foi utilizada recentemente (está no histórico de senhas).

```json
{
  "ok": false,
  "code": "password_reused",
  "message": "Esta senha foi utilizada recentemente. Escolha uma senha diferente."
}
```

#### `password_not_set` (400)

A conta do usuário não possui senha definida (autenticação OAuth).

```json
{
  "ok": false,
  "code": "password_not_set",
  "message": "Conta sem senha definida"
}
```

#### `too_many_attempts` (429)

Limite de rate limiting excedido.

```json
{
  "ok": false,
  "code": "too_many_attempts",
  "message": "Muitas tentativas. Tente novamente em alguns minutos."
}
```

#### `service_unavailable` (503)

Banco de dados ou serviço indisponível.

```json
{
  "ok": false,
  "code": "service_unavailable",
  "message": "Serviço temporariamente indisponível. Tente novamente em instantes."
}
```

#### `internal_error` (500)

Erro interno não tratado.

```json
{
  "ok": false,
  "code": "internal_error",
  "message": "Erro interno do servidor"
}
```

---

## Exemplos de Uso

### Exemplo: Alteração de Senha com Sucesso

**Request**:
```bash
curl -X POST https://app.enviolegal.com.br/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "currentPassword": "MyOldP@ss123",
    "newPassword": "MyNewP@ss456!",
    "confirmPassword": "MyNewP@ss456!"
  }'
```

**Response (200)**:
```json
{
  "ok": true,
  "sessionInvalidated": true
}
```

**Efeitos**:
- Senha atualizada no banco de dados
- Sessões anteriores invalidadas
- E-mail de notificação enviado
- Evento `PASSWORD_CHANGED` registrado

---

### Exemplo: Senha Atual Incorreta

**Request**:
```bash
curl -X POST https://app.enviolegal.com.br/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "currentPassword": "WrongPassword",
    "newPassword": "MyNewP@ss456!",
    "confirmPassword": "MyNewP@ss456!"
  }'
```

**Response (400)**:
```json
{
  "ok": false,
  "code": "current_password_incorrect",
  "message": "Senha atual incorreta"
}
```

**Efeitos**:
- Nenhuma alteração no banco
- Evento `LOGIN_FAILED` registrado (com motivo `invalid_current_password`)

---

### Exemplo: Política de Senha Não Atendida

**Request**:
```bash
curl -X POST https://app.enviolegal.com.br/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "currentPassword": "MyOldP@ss123",
    "newPassword": "weak",
    "confirmPassword": "weak"
  }'
```

**Response (400)**:
```json
{
  "ok": false,
  "code": "password_policy_failed",
  "message": "A senha não atende aos requisitos de segurança",
  "details": {
    "errors": [
      "A senha deve ter no mínimo 8 caracteres",
      "A senha deve conter pelo menos uma letra maiúscula",
      "A senha deve conter pelo menos um número",
      "A senha deve conter pelo menos um caractere especial (!@#$%^&*...)"
    ]
  }
}
```

---

### Exemplo: Rate Limit Excedido

Após 3 tentativas em 15 minutos:

**Response (429)**:
```json
{
  "ok": false,
  "code": "too_many_attempts",
  "message": "Muitas tentativas. Tente novamente em alguns minutos."
}
```

---

## Segurança

### Boas Práticas Implementadas

1. **Hashing Seguro**: Senhas são armazenadas usando bcrypt com 12 rounds de salt
2. **Comparação em Tempo Constante**: Bcrypt.compare previne ataques de timing
3. **Rate Limiting**: Proteção contra força bruta em dois níveis (IP e usuário)
4. **Invalidação de Sessões**: Logout global ao alterar senha
5. **Histórico de Senhas**: Previne reutilização das últimas 5 senhas
6. **Auditoria Completa**: Todos os eventos são registrados
7. **Notificação por E-mail**: Usuário é alertado sobre mudanças de senha
8. **Política de Senha Forte**: Requisitos mínimos de complexidade
9. **Senhas Comuns Bloqueadas**: Lista de senhas muito comuns é rejeitada
10. **HTTPS Only**: Cookies de sessão com flag `httpOnly` e `secure`

### Próximos Passos (Melhorias Futuras)

- [ ] Implementar CAPTCHA após múltiplas tentativas falhadas
- [ ] Adicionar autenticação de dois fatores (2FA)
- [ ] Permitir visualizar e revogar sessões ativas
- [ ] Adicionar notificação push/SMS além de e-mail
- [ ] Implementar "Trusted Devices" (dispositivos confiáveis)
- [ ] Expiração forçada de senha a cada N dias (opcional)
- [ ] Integração com serviços de verificação de senhas vazadas (HaveIBeenPwned)

---

## Suporte

Para dúvidas ou problemas relacionados à API de segurança, consulte:

- **Documentação Geral**: `/docs/API.md`
- **Repositório**: `github.com/enviolegal/enviolegal-api`
- **Suporte**: suporte@enviolegal.com.br
