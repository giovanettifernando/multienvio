#!/usr/bin/env bash
set -euo pipefail

# =====================================================
# Setup Envio Legal - Ambiente de Desenvolvimento
# =====================================================

echo "============================================="
echo "  Setup Envio Legal - Ambiente Dev"
echo "============================================="
echo ""

# ----- Coleta de informacoes -----

read -rp "Caminho absoluto do projeto (onde sera criado o .env): " PROJECT_DIR
if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "ERRO: O diretorio '$PROJECT_DIR' nao existe."
  exit 1
fi

read -rp "Caminho absoluto do arquivo de dump (.dump): " DUMP_PATH
if [[ ! -f "$DUMP_PATH" ]]; then
  echo "ERRO: O arquivo '$DUMP_PATH' nao existe."
  exit 1
fi

read -rp "Usuario do banco (padrao: envio_dev): " DB_USER
DB_USER=${DB_USER:-envio_dev}

read -rsp "Senha do banco (padrao: envio_dev): " DB_PASS
echo ""
DB_PASS=${DB_PASS:-envio_dev}

read -rp "Nome do banco (padrao: enviolegal_dev): " DB_NAME
DB_NAME=${DB_NAME:-enviolegal_dev}

DB_PORT=5432

# ----- 1. Instalar PostgreSQL 16 -----

echo ""
echo "[1/5] Instalando PostgreSQL..."

if command -v psql &>/dev/null; then
  echo "  PostgreSQL ja esta instalado: $(psql --version)"
else
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
  echo "  PostgreSQL instalado com sucesso."
fi

# Garantir que o servico esteja rodando
sudo systemctl enable postgresql
sudo systemctl start postgresql

# ----- 2. Criar usuario e banco -----

echo "[2/5] Configurando usuario e banco de dados..."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'DROP DATABASE ${DB_NAME}' WHERE EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}');
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "  Usuario '${DB_USER}' e banco '${DB_NAME}' configurados."

# ----- 3. Restaurar dump -----

echo "[3/5] Restaurando dump..."
pg_restore \
  --no-owner \
  --no-privileges \
  --role="${DB_USER}" \
  -d "postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}" \
  "$DUMP_PATH" || true
echo "  Dump restaurado."

# ----- 4. Instalar Redis (se nao existir) -----

echo "[4/5] Verificando Redis..."
if command -v redis-server &>/dev/null; then
  echo "  Redis ja esta instalado."
else
  sudo apt-get install -y -qq redis-server
  sudo systemctl enable redis-server
  sudo systemctl start redis-server
  echo "  Redis instalado e iniciado."
fi

# ----- 5. Criar .env -----

echo "[5/5] Criando .env..."

DB_URL_ENCODED_PASS=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASS}', safe=''))")

cat > "${PROJECT_DIR}/.env" <<ENVFILE
# =====================================================
# AMBIENTE
# =====================================================
NODE_ENV=development
APP_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000/

# =====================================================
# BANCO DE DADOS
# =====================================================
DATABASE_URL="postgresql://${DB_USER}:${DB_URL_ENCODED_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}?schema=public"

# =====================================================
# REDIS (BullMQ workers)
# =====================================================
REDIS_URL=redis://127.0.0.1:6379

# =====================================================
# NEXTAUTH
# =====================================================
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=http://localhost:3000

# =====================================================
# SEGREDOS JWT
# =====================================================
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_JWT_SECRET=$(openssl rand -hex 32)
COLLECTOR_JWT_SECRET=$(openssl rand -hex 32)

# =====================================================
# CHAVES DE CRIPTOGRAFIA
# =====================================================
ENCRYPTION_KEY=$(openssl rand -hex 32)
CARD_VAULT_KEY=$(openssl rand -base64 32)

# =====================================================
# SEGREDOS DE ENDPOINTS INTERNOS
# =====================================================
CRON_SECRET=$(openssl rand -hex 24)
TRACKING_WEBHOOK_SECRET=$(openssl rand -hex 24)

# =====================================================
# INFRA
# =====================================================
TRUST_PROXY=false
LOG_LEVEL=debug
LOG_DIR=${PROJECT_DIR}/logs
ENVFILE

echo "  .env criado em ${PROJECT_DIR}/.env"

# ----- Resumo -----

echo ""
echo "============================================="
echo "  Setup concluido!"
echo "============================================="
echo ""
echo "  Banco:   postgresql://${DB_USER}:****@127.0.0.1:${DB_PORT}/${DB_NAME}"
echo "  Redis:   redis://127.0.0.1:6379"
echo "  .env:    ${PROJECT_DIR}/.env"
echo ""
echo "  Proximos passos:"
echo "    cd ${PROJECT_DIR}"
echo "    pnpm install"
echo "    pnpm prisma generate"
echo "    pnpm dev"
echo ""
