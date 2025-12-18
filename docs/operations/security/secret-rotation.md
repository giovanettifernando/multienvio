# Rotação de Secrets — Envio Legal

Documentação dos procedimentos de rotação de secrets sensíveis do sistema.

## Índice

- [Visão Geral](#visão-geral)
- [Secrets Gerenciados](#secrets-gerenciados)
- [Rotação de JWT_SECRET](#rotação-de-jwt_secret)
- [Rotação de CARD_VAULT_KEY](#rotação-de-card_vault_key)
- [Checklist Pré-Rotação](#checklist-pré-rotação)
- [Troubleshooting](#troubleshooting)

---

## Visão Geral

A rotação periódica de secrets é uma prática essencial de segurança. Este documento descreve como rotacionar cada secret sem causar indisponibilidade.

### Quando Rotacionar

- **Rotação programada**: A cada 90 dias (recomendado)
- **Suspeita de comprometimento**: Imediatamente
- **Saída de colaborador**: Com acesso aos secrets
- **Incidente de segurança**: Após investigação

---

## Secrets Gerenciados

| Secret | Descrição | Impacto se Comprometido |
|--------|-----------|-------------------------|
| `JWT_SECRET` | Assinatura de tokens de autenticação | Atacante pode forjar sessões |
| `ADMIN_JWT_SECRET` | Assinatura de tokens admin | Atacante pode forjar sessões admin |
| `CARD_VAULT_KEY` | Criptografia de PANs (números de cartão) | Exposição de dados de cartões |
| `DATABASE_URL` | Credenciais do PostgreSQL | Acesso total ao banco de dados |
| `REDIS_URL` | Credenciais do Redis | Acesso ao cache e rate limiting |
| `MERCADOPAGO_ACCESS_TOKEN` | API do MercadoPago | Transações fraudulentas |

---

## Rotação de JWT_SECRET

### Impacto

Ao rotacionar `JWT_SECRET`, **todas as sessões ativas serão invalidadas**. Usuários precisarão fazer login novamente.

### Procedimento

#### 1. Gerar Nova Chave

```bash
# Gerar chave segura de 64 bytes
openssl rand -base64 64
```

#### 2. Atualizar Variáveis de Ambiente

```bash
# Produção (via painel de deploy ou secrets manager)
JWT_SECRET="nova_chave_aqui"
ADMIN_JWT_SECRET="nova_chave_admin_aqui"  # Se separado
```

#### 3. Deploy

```bash
# Realizar deploy da aplicação
# Todas as instâncias receberão o novo secret
```

#### 4. Verificação

```bash
# 1. Verificar se logins estão funcionando
curl -X POST https://app.enviolegal.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"..."}'

# 2. Verificar logs de erro
# Não deve haver erros de verificação JWT

# 3. Monitorar métricas de autenticação
# Taxa de login deve normalizar em ~15min
```

### Rollback

Se problemas ocorrerem, restaurar o `JWT_SECRET` anterior e fazer novo deploy.

---

## Rotação de CARD_VAULT_KEY

### Impacto

A rotação de `CARD_VAULT_KEY` requer **migração gradual** dos dados criptografados. O sistema suporta duas chaves simultaneamente durante a transição.

### Arquitetura de Rotação

```
┌─────────────────────────────────────────────────────────────┐
│                    Fluxo de Descriptografia                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Dados Criptografados                                      │
│         │                                                   │
│         ▼                                                   │
│   ┌─────────────┐                                          │
│   │ Tentar com  │──── Sucesso ──▶ Retorna PAN              │
│   │ CARD_VAULT_KEY │                                       │
│   └─────────────┘                                          │
│         │                                                   │
│       Falha                                                │
│         ▼                                                   │
│   ┌─────────────┐                                          │
│   │ Tentar com  │──── Sucesso ──▶ Retorna PAN              │
│   │ CARD_VAULT_KEY_OLD │          + Log "recriptografar"   │
│   └─────────────┘                                          │
│         │                                                   │
│       Falha                                                │
│         ▼                                                   │
│   Erro: Dados corrompidos                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Procedimento

#### Fase 1: Preparação (Pré-Deploy)

```bash
# 1. Gerar nova chave de 32 bytes
openssl rand -base64 32
# Exemplo: K9xmP2nQ7rS4uV5wY8zA1bC3dE6fG0hI2jL3mN4oP5=

# 2. Documentar a chave atual (backup seguro)
# IMPORTANTE: Armazenar em password manager ou vault
```

#### Fase 2: Configurar Dual-Key (Deploy 1)

```bash
# Configurar ambiente com ambas as chaves
CARD_VAULT_KEY="nova_chave_base64_32_bytes"
CARD_VAULT_KEY_OLD="chave_anterior_base64_32_bytes"
```

```bash
# Deploy da aplicação
# A partir deste ponto:
# - Novos dados são criptografados com CARD_VAULT_KEY
# - Dados antigos podem ser lidos com CARD_VAULT_KEY_OLD
```

#### Fase 3: Migração de Dados

Executar script de migração para recriptografar dados existentes:

```typescript
// scripts/migrate-card-vault-keys.ts
import { prisma } from '@/lib/db';
import {
  loadVaultKey,
  loadOldVaultKey,
  parsePanCipher,
  decryptPan,
  encryptPan,
  serializePanCipher,
} from '@/lib/crypto/card-vault';

async function migrateCardVaultKeys() {
  const currentKey = loadVaultKey();
  const oldKey = loadOldVaultKey();

  if (!currentKey) {
    throw new Error('CARD_VAULT_KEY não configurada');
  }

  // Buscar todos os cartões com PAN criptografado
  const cards = await prisma.savedCard.findMany({
    where: {
      panCipher: { not: null },
    },
    select: {
      id: true,
      panCipher: true,
    },
  });

  console.log(`Encontrados ${cards.length} cartões para migrar`);

  let migrated = 0;
  let errors = 0;

  for (const card of cards) {
    try {
      const payload = parsePanCipher(card.panCipher);
      if (!payload) continue;

      // Tentar descriptografar
      // Se usar chave antiga, reencriptar com nova
      const pan = decryptPan(payload, currentKey);

      // Reencriptar com chave atual
      const newPayload = encryptPan(pan, currentKey);

      await prisma.savedCard.update({
        where: { id: card.id },
        data: {
          panCipher: serializePanCipher(newPayload),
        },
      });

      migrated++;
    } catch (error) {
      console.error(`Erro ao migrar cartão ${card.id}:`, error);
      errors++;
    }
  }

  console.log(`Migração completa: ${migrated} sucesso, ${errors} erros`);
}

migrateCardVaultKeys().catch(console.error);
```

```bash
# Executar migração
npx tsx scripts/migrate-card-vault-keys.ts
```

#### Fase 4: Remover Chave Antiga (Deploy 2)

Após confirmar que todos os dados foram migrados:

```bash
# Remover CARD_VAULT_KEY_OLD
# Apenas CARD_VAULT_KEY deve estar configurada
CARD_VAULT_KEY="nova_chave_base64_32_bytes"
# CARD_VAULT_KEY_OLD= (removido)
```

```bash
# Deploy final
```

### Verificação

```bash
# 1. Verificar se cartões podem ser usados
# Testar pagamento com cartão salvo no staging

# 2. Verificar logs
# Não deve haver logs de "decrypted_with_old_key"

# 3. Verificar que CARD_VAULT_KEY_OLD foi removida
echo $CARD_VAULT_KEY_OLD  # Deve estar vazio
```

### Rollback

Se problemas ocorrerem durante a migração:

1. **Fase 2**: Restaurar `CARD_VAULT_KEY` anterior como `CARD_VAULT_KEY` e remover `_OLD`
2. **Fase 3**: Script de migração é idempotente, pode ser reexecutado
3. **Fase 4**: Restaurar `CARD_VAULT_KEY_OLD` se ainda houver dados não migrados

---

## Checklist Pré-Rotação

### JWT_SECRET

- [ ] Comunicar equipe sobre invalidação de sessões
- [ ] Escolher horário de baixo tráfego
- [ ] Preparar nova chave (64+ bytes, base64)
- [ ] Backup da chave atual em vault seguro
- [ ] Ter rollback plan documentado
- [ ] Monitoramento de erros de autenticação ativo

### CARD_VAULT_KEY

- [ ] Verificar que ambiente staging tem dados de teste
- [ ] Testar procedimento completo em staging
- [ ] Preparar nova chave (32 bytes exatos, base64)
- [ ] Backup da chave atual em vault seguro
- [ ] Script de migração testado
- [ ] Estimar tempo de migração baseado em volume de dados
- [ ] Planejar janela de manutenção se necessário

---

## Troubleshooting

### JWT: "Invalid signature" após rotação

**Causa**: Token antigo sendo usado com nova chave.

**Solução**: Comportamento esperado. Usuário deve fazer login novamente.

### JWT: Todos os usuários recebendo 401

**Causa**: Nova chave inválida ou não propagada.

**Solução**:
1. Verificar se `JWT_SECRET` está correto no ambiente
2. Verificar se todas as instâncias receberam o deploy
3. Rollback se necessário

### Card Vault: "Failed to decrypt" após rotação

**Causa**: Dado criptografado com chave não disponível.

**Solução**:
1. Verificar se `CARD_VAULT_KEY_OLD` está configurada
2. Verificar logs para identificar qual chave foi usada originalmente
3. Se chave original for anterior a `_OLD`, dados podem estar irrecuperáveis

### Card Vault: Migração muito lenta

**Causa**: Volume alto de dados ou índices faltando.

**Solução**:
1. Executar migração em batches
2. Adicionar índice em `panCipher` se necessário
3. Executar durante horário de baixo uso

---

## Logs de Auditoria

O sistema registra eventos relacionados a rotação:

```json
// Descriptografia com chave antiga (requer migração)
{
  "event": "card_vault_decrypted_with_old_key",
  "level": "info",
  "message": "PAN decrypted with old key - consider re-encrypting"
}

// Falha em ambas as chaves
{
  "event": "card_vault_decrypt_failed_both_keys",
  "level": "error",
  "message": "Failed to decrypt PAN with both current and old keys"
}

// Chave inválida
{
  "event": "card_vault_key_invalid_length",
  "level": "error",
  "envVar": "CARD_VAULT_KEY",
  "length": 24,
  "expected": 32
}
```

---

## Referências

- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [NIST SP 800-57: Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [AWS Secrets Manager Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)

---

## Suporte

Para dúvidas ou incidentes relacionados a rotação de secrets:

- **Documentação de Autenticação**: [auth-token-version.md](../../architecture/auth/auth-token-version.md)
- **Segurança de API**: [api-account-security.md](../../architecture/api/api-account-security.md)
- **Plano de Segurança**: [security-cleanup-plan.md](./security-cleanup-plan.md)
