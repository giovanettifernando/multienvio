# Testando a Funcionalidade de Alteração de Senha

Este documento descreve como testar a funcionalidade de alteração de senha implementada.

## Pré-requisitos

1. Servidor Next.js rodando (`pnpm dev`)
2. Banco de dados PostgreSQL configurado e migrações aplicadas
3. Usuário cadastrado e autenticado no sistema
4. Cookie de sessão válido (fazer login antes)

## Executar Testes Unitários

Os testes unitários validam a lógica de negócio sem necessidade do servidor:

```bash
tsx tests/security-change-password.test.ts
```

### O que é testado:

✅ Política de senha (comprimento mínimo, maiúscula, minúscula, número, especial)
✅ Detecção de senhas comuns
✅ Prevenção de reutilização de senhas
✅ Atualização de histórico de senhas

## Testar a API Manualmente

### 1. Iniciar o servidor

```bash
pnpm dev
```

### 2. Fazer login e obter cookie de sessão

Primeiro, faça login na aplicação através do navegador ou via API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@example.com",
    "password": "SuaSenhaAtual123!"
  }' \
  -c cookies.txt
```

### 3. Testar alteração de senha - Sucesso

```bash
curl -X POST http://localhost:3000/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword": "SuaSenhaAtual123!",
    "newPassword": "NovaSenha@2025!",
    "confirmPassword": "NovaSenha@2025!"
  }'
```

**Resposta esperada (200)**:
```json
{
  "ok": true,
  "sessionInvalidated": true
}
```

**Efeitos colaterais**:
- ✅ Senha alterada no banco de dados
- ✅ E-mail de notificação enviado
- ✅ Evento `PASSWORD_CHANGED` registrado em `user_security_events`
- ✅ Sessões anteriores invalidadas

### 4. Testar senha atual incorreta

```bash
curl -X POST http://localhost:3000/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword": "SenhaErrada123!",
    "newPassword": "NovaSenha@2025!",
    "confirmPassword": "NovaSenha@2025!"
  }'
```

**Resposta esperada (400)**:
```json
{
  "ok": false,
  "code": "current_password_incorrect",
  "message": "Senha atual incorreta"
}
```

### 5. Testar política de senha

```bash
curl -X POST http://localhost:3000/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword": "SuaSenhaAtual123!",
    "newPassword": "fraca",
    "confirmPassword": "fraca"
  }'
```

**Resposta esperada (400)**:
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

### 6. Testar senha igual à atual

```bash
curl -X POST http://localhost:3000/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword": "SuaSenhaAtual123!",
    "newPassword": "SuaSenhaAtual123!",
    "confirmPassword": "SuaSenhaAtual123!"
  }'
```

**Resposta esperada (400)**:
```json
{
  "ok": false,
  "code": "password_unchanged",
  "message": "A nova senha deve ser diferente da senha atual"
}
```

### 7. Testar confirmação de senha diferente

```bash
curl -X POST http://localhost:3000/api/account/security/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword": "SuaSenhaAtual123!",
    "newPassword": "NovaSenha@2025!",
    "confirmPassword": "SenhaDiferente@2025!"
  }'
```

**Resposta esperada (400)**:
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

### 8. Testar rate limiting

Execute o mesmo comando 4 vezes seguidas:

```bash
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/account/security/change-password \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d '{
      "currentPassword": "SenhaErrada",
      "newPassword": "Test@123!",
      "confirmPassword": "Test@123!"
    }'
  echo "\n--- Tentativa $i ---\n"
done
```

**Resposta esperada na 4ª tentativa (429)**:
```json
{
  "ok": false,
  "code": "too_many_attempts",
  "message": "Muitas tentativas. Tente novamente em alguns minutos."
}
```

## Verificar Auditoria

Verificar eventos de segurança registrados no banco de dados:

```sql
SELECT
  id,
  "userId",
  type,
  ip,
  "userAgent",
  metadata,
  "createdAt"
FROM
  user_security_events
WHERE
  "userId" = 'seu-user-id'
ORDER BY
  "createdAt" DESC
LIMIT 10;
```

**Tipos de eventos esperados**:
- `PASSWORD_CHANGED`: Quando a senha foi alterada com sucesso
- `LOGIN_FAILED`: Quando a senha atual estava incorreta

## Verificar E-mail

Após uma alteração de senha bem-sucedida, você deve receber um e-mail com:

- ✅ Assunto: "Senha alterada com sucesso - Envio Legal"
- ✅ Conteúdo informando data/hora da alteração
- ✅ Detalhes de IP e dispositivo (se disponível)
- ✅ Aviso sobre comprometimento da conta
- ✅ Link para configurações de segurança

**Nota**: Verifique os logs do servidor para confirmar o envio do e-mail.

## Verificar Histórico de Senhas

Verificar se o histórico de senhas foi atualizado:

```sql
SELECT
  id,
  email,
  "passwordUpdatedAt",
  "passwordHistory"
FROM
  users
WHERE
  id = 'seu-user-id';
```

**Esperado**:
- `passwordUpdatedAt`: Data/hora da última alteração
- `passwordHistory`: Array JSON com os últimos hashes (máximo 5)

## Testar Reutilização de Senha

1. Altere a senha para `Senha1@Test`
2. Altere novamente para `Senha2@Test`
3. Tente alterar de volta para `Senha1@Test`

**Resposta esperada (400)**:
```json
{
  "ok": false,
  "code": "password_reused",
  "message": "Esta senha foi utilizada recentemente. Escolha uma senha diferente."
}
```

## Checklist de Validação

Antes de considerar o teste completo, verifique:

- [ ] Testes unitários passam (16/16)
- [ ] Alteração de senha com sucesso (200)
- [ ] Senha atual incorreta retorna erro (400)
- [ ] Política de senha é validada (400)
- [ ] Senha igual à atual é rejeitada (400)
- [ ] Confirmação de senha diferente é rejeitada (400)
- [ ] Rate limiting funciona após 3 tentativas (429)
- [ ] Evento `PASSWORD_CHANGED` é registrado no banco
- [ ] E-mail de notificação é enviado
- [ ] Histórico de senhas é atualizado
- [ ] Reutilização de senha é bloqueada (400)
- [ ] Sessões anteriores são invalidadas

## Problemas Conhecidos

### E-mail não enviado

Se o e-mail não for enviado, verifique:
1. Configuração SMTP em `.env.local`
2. Variáveis `EMAIL_USER` e `EMAIL_PASSWORD` estão corretas
3. Logs do servidor para mensagens de erro

**Nota**: O envio de e-mail é assíncrono e não bloqueia a resposta da API. Falhas no envio não afetam o sucesso da operação.

### Rate limit muito restritivo

Para ambiente de desenvolvimento, você pode ajustar os limites em:
`app/api/account/security/change-password/route.ts`

```typescript
// Aumentar limite para testes
enforceRateLimit({
  key: `change-password:user:${userId}`,
  limit: 10, // Aumentar de 3 para 10
  windowMs: 15 * 60 * 1000,
});
```

## Ferramentas Úteis

### Insomnia / Postman

Importe a coleção de requisições para testar via interface gráfica:

```json
{
  "name": "Change Password",
  "request": {
    "method": "POST",
    "url": "http://localhost:3000/api/account/security/change-password",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"currentPassword\": \"SuaSenhaAtual123!\",\n  \"newPassword\": \"NovaSenha@2025!\",\n  \"confirmPassword\": \"NovaSenha@2025!\"\n}"
    }
  }
}
```

### Logs do Servidor

Acompanhe os logs do servidor durante os testes:

```bash
pnpm dev | grep -i "change-password\|security"
```

## Referências

- [Documentação da API](../../architecture/api/api-account-security.md)
- [Schema Prisma](../prisma/schema.prisma)
- [Serviço de Segurança](../lib/services/account-security.service.ts)
- [Validação de Política](../lib/validation/password-policy.ts)
