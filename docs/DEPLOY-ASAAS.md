# Deploy da migração Asaas — procedimento

**Alvo:** `138.59.147.223:10060`, usuário `root`, pasta `/opt/app/envio-legal`
**Ambiente:** sandbox (para o cliente homologar). **Não é a virada para produção.**

> O sistema ainda não atende clientes reais, então este deploy não interrompe
> faturamento. Ainda assim, faça o backup do passo 1 — ele custa segundos.

---

## Antes de começar

Tenha em mãos:

- **A chave de sandbox do Asaas** (começa com `$aact_hmlg_`) — está no `.env` local
- **O token de webhook** — o mesmo cadastrado no painel `/admin/asaas`

> Os dois **não** vêm com o código: o arquivo de variáveis de ambiente é
> ignorado pelo git de propósito. Precisam ser configurados no servidor.

---

## 1. Backup do banco

```bash
ssh -p 10060 root@138.59.147.223
cd /opt/app/envio-legal

# O sed remove o "?schema=public" do fim da URL — o pg_dump rejeita esse
# parâmetro e o backup sai vazio (0 bytes) sem avisar direito.
pg_dump "$(grep -oP '^DATABASE_URL="\K[^"]+' .env | sed 's/?schema=public//')" \
  > ~/backup-antes-asaas-$(date +%Y%m%d-%H%M).sql

ls -lh ~/backup-antes-asaas-*.sql
```

Confira que o arquivo tem tamanho razoável antes de seguir. **Se vier com 0
bytes, o backup falhou** — não prossiga.

---

## 2. Trazer o código

```bash
cd /opt/app/envio-legal
git fetch origin
git log --oneline HEAD..origin/main | head -5   # veja o que vai entrar
git pull origin main
```

---

## 3. Configurar as variáveis do Asaas

```bash
cd /opt/app/envio-legal

# Confira se já existem (não duplique)
grep -E "^ASAAS_" .env
```

Se não existirem, acrescente ao `.env`:

```
ASAAS_API_KEY=$aact_hmlg_COLE_A_CHAVE_AQUI
ASAAS_BASE_URL=https://api-sandbox.asaas.com
ASAAS_WEBHOOK_TOKEN=COLE_O_TOKEN_AQUI
```

Remova as linhas antigas do gateway anterior, se houver (`PAGARME_*`).

---

## 4. Instalar dependências

```bash
pnpm install
```

> Uma dependência nova foi declarada nesta entrega (`tsx`) — sem este passo o
> processo de workers não sobe.

---

## 5. Aplicar as migrations

```bash
cd /opt/app/envio-legal
export DATABASE_URL=$(grep -oP '^DATABASE_URL="\K[^"]+' .env)

pnpm prisma migrate status     # veja o que está pendente
pnpm prisma migrate deploy     # aplica
pnpm prisma generate
```

**Use `migrate deploy`, não `migrate dev`.** O `dev` tenta criar um banco
temporário e pode oferecer resetar tudo — em servidor isso é destrutivo.

As migrations desta entrega são aditivas (duas colunas novas) e não apagam
dados.

Se aparecer erro de drift (banco com algo que o histórico não explica), **pare
e resolva antes** — não force.

---

## 6. Construir e reiniciar a aplicação

```bash
cd /opt/app/envio-legal
pnpm build
systemctl restart enviolegal
systemctl status enviolegal --no-pager | head -15
```

---

## 7. Subir o processo de workers ⚠️

**Este passo é obrigatório e é o mais fácil de esquecer.**

O processo de workers é quem recebe a confirmação de pagamento do Asaas e
reflete no sistema. **Sem ele, PIX e boleto nunca completam**: a cobrança é
gerada, o cliente paga, e nada acontece — nem crédito na carteira, nem
liberação de envio.

Verifique se já existe um serviço para ele:

```bash
systemctl list-units --type=service | grep -i -E "worker|enviolegal"
```

**Se existir:** `systemctl restart <nome-do-servico>`

**Se não existir**, crie `/etc/systemd/system/enviolegal-workers.service`:

```ini
[Unit]
Description=Envio Legal - Workers (BullMQ)
After=network.target redis-server.service postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/app/envio-legal
ExecStart=/usr/bin/env pnpm workers
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now enviolegal-workers
systemctl status enviolegal-workers --no-pager | head -20
```

**Confirme na saída** que aparecem estes dois:

```
- payment.pix-monitor (concurrency: 1)
- webhook.asaas (concurrency: 5)
```

---

## 8. Cadastrar o webhook no Asaas

No painel do sandbox (`sandbox.asaas.com`), em **Integrações → Webhooks**:

- **URL:** `https://SEU-DOMINIO/api/webhooks/asaas`
- **Token:** o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- **Eventos:** os de cobrança (confirmada, recebida, vencida, estornada)

> Sem isso, a confirmação depende só da varredura automática a cada 2 minutos.
> Funciona, mas com atraso — e é bom testar o caminho real.

---

## 9. Verificar

```bash
# A aplicação enxerga o Asaas?
curl -s https://SEU-DOMINIO/api/health/dependencies | grep -o '"asaas"[^}]*}'
```

Esperado: algo com `"status":"ok"`.

Depois, no navegador:

1. Entrar no sistema
2. Carteira → adicionar saldo → **R$ 5,00** (mínimo do Asaas) via PIX
3. Confirmar que o QR Code aparece
4. Painel `/admin/asaas` → deve mostrar "Configurado / ACTIVE / Sandbox"

---

## 10. Teste que fecha o ciclo (o mais importante)

1. Gerar uma cobrança PIX ou boleto pelo sistema
2. No painel do sandbox, achar a cobrança e **simular o recebimento**
3. Em até 2 minutos, conferir que o saldo foi creditado (ou o envio liberado)

Acompanhe pelos logs:

```bash
journalctl -u enviolegal-workers -f
```

**Se isso funcionar, a migração está provada de ponta a ponta.** É o único
teste que ainda não foi feito.

---

## Se der errado

```bash
cd /opt/app/envio-legal
git log --oneline -3
git reset --hard <hash-anterior>
pnpm install && pnpm build
systemctl restart enviolegal enviolegal-workers
```

O banco não precisa de rollback: as migrations só adicionam colunas, e código
antigo simplesmente as ignora.

Backup do passo 1, se necessário:

```bash
psql "$DATABASE_URL" < ~/backup-antes-asaas-XXXXXX.sql
```

---

## Depois: virar para produção

Quando o cliente aprovar:

1. Conseguir a chave de produção (`$aact_prod_...`) na conta do cliente em
   `www.asaas.com` → Configurações → Integrações
2. **Validar antes de usar:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     -H "access_token: CHAVE_DE_PRODUCAO" \
     "https://api.asaas.com/v3/customers?limit=1"
   ```
   `200` = ok. Qualquer outra coisa = **não vire**.
3. No painel `/admin/asaas`: colar a chave nova e desligar o "Modo Sandbox" —
   o endereço da API muda sozinho, **sem precisar de novo deploy**
4. Cadastrar o webhook também no painel de produção

> O passo 2 não é burocracia: a migração anterior (Pagar.me) foi inteira
> escrita e revisada com uma chave que nunca autenticou. O erro só apareceu no
> fim. Um comando evita repetir isso.
