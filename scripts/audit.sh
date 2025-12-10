#!/bin/bash
#
# audit.sh - Script de auditoria de segurança para CI local
#
# Uso:
#   ./scripts/audit.sh           # Execução padrão (falha em vulnerabilidades high/critical)
#   ./scripts/audit.sh --strict  # Falha em qualquer vulnerabilidade
#   ./scripts/audit.sh --report  # Gera relatório detalhado
#
# Exit codes:
#   0 - Sem vulnerabilidades encontradas no nível especificado
#   1 - Vulnerabilidades encontradas
#   2 - Erro de execução
#

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
STRICT_MODE=false
REPORT_MODE=false
REPORT_FILE="audit-report-$(date +%Y%m%d-%H%M%S).json"

# Parse argumentos
for arg in "$@"; do
  case $arg in
    --strict)
      STRICT_MODE=true
      shift
      ;;
    --report)
      REPORT_MODE=true
      shift
      ;;
    --help|-h)
      echo "Uso: $0 [--strict] [--report]"
      echo ""
      echo "Opções:"
      echo "  --strict  Falha em qualquer nível de vulnerabilidade"
      echo "  --report  Gera arquivo JSON com relatório detalhado"
      echo ""
      exit 0
      ;;
  esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔒 Auditoria de Segurança - EnvioLegal${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Erro: package.json não encontrado. Execute do diretório raiz do projeto.${NC}"
  exit 2
fi

# ─────────────────────────────────────────────────────────────────
# 1. npm audit
# ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}📦 Executando npm audit...${NC}"
echo ""

# Capturar output do npm audit
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)

# Extrair contagens de vulnerabilidades
CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0')
HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0')
MODERATE=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.moderate // 0')
LOW=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.low // 0')
INFO=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.info // 0')
TOTAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.total // 0')

# Mostrar resumo
echo "  Resumo de Vulnerabilidades:"
echo "  ─────────────────────────────"
if [ "$CRITICAL" -gt 0 ]; then
  echo -e "    ${RED}Critical: $CRITICAL${NC}"
else
  echo "    Critical: $CRITICAL"
fi
if [ "$HIGH" -gt 0 ]; then
  echo -e "    ${RED}High:     $HIGH${NC}"
else
  echo "    High:     $HIGH"
fi
if [ "$MODERATE" -gt 0 ]; then
  echo -e "    ${YELLOW}Moderate: $MODERATE${NC}"
else
  echo "    Moderate: $MODERATE"
fi
echo "    Low:      $LOW"
echo "    Info:     $INFO"
echo "  ─────────────────────────────"
echo "    Total:    $TOTAL"
echo ""

# Gerar relatório se solicitado
if [ "$REPORT_MODE" = true ]; then
  echo "$AUDIT_OUTPUT" > "$REPORT_FILE"
  echo -e "${GREEN}📄 Relatório salvo em: $REPORT_FILE${NC}"
  echo ""
fi

# ─────────────────────────────────────────────────────────────────
# 2. Verificar arquivos sensíveis no staging
# ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🔍 Verificando arquivos sensíveis...${NC}"
echo ""

SENSITIVE_PATTERNS=(
  "\.env$"
  "\.env\.local$"
  "\.env\.production$"
  "credentials\.json$"
  "service-account\.json$"
  "\.pem$"
  "\.key$"
  "id_rsa"
  "id_ed25519"
  "\.p12$"
  "\.pfx$"
)

SENSITIVE_FOUND=false

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  # Verificar em arquivos tracked
  MATCHES=$(git ls-files 2>/dev/null | grep -E "$pattern" || true)
  if [ -n "$MATCHES" ]; then
    echo -e "  ${RED}⚠️  Arquivo sensível no repositório: $MATCHES${NC}"
    SENSITIVE_FOUND=true
  fi
done

if [ "$SENSITIVE_FOUND" = false ]; then
  echo -e "  ${GREEN}✓ Nenhum arquivo sensível encontrado no repositório${NC}"
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 3. Verificar secrets hardcoded (básico)
# ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🔑 Verificando secrets hardcoded...${NC}"
echo ""

# Patterns que podem indicar secrets hardcoded
SECRET_PATTERNS=(
  "PRIVATE.*KEY"
  "API_KEY\s*=\s*['\"][^'\"]+['\"]"
  "SECRET\s*=\s*['\"][^'\"]+['\"]"
  "PASSWORD\s*=\s*['\"][^'\"]+['\"]"
  "Bearer\s+[A-Za-z0-9_-]{20,}"
)

SECRETS_FOUND=false

for pattern in "${SECRET_PATTERNS[@]}"; do
  # Buscar em arquivos TS/JS (excluindo node_modules, .next, etc)
  MATCHES=$(grep -rE "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
    . 2>/dev/null | grep -v "process\.env" | grep -v "\.example" | head -5 || true)

  if [ -n "$MATCHES" ]; then
    echo -e "  ${YELLOW}⚠️  Possível secret encontrado (verifique manualmente):${NC}"
    echo "$MATCHES" | head -3
    SECRETS_FOUND=true
  fi
done

if [ "$SECRETS_FOUND" = false ]; then
  echo -e "  ${GREEN}✓ Nenhum secret hardcoded óbvio encontrado${NC}"
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 4. Verificar dependências deprecated
# ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}📋 Verificando dependências...${NC}"
echo ""

# Verificar npm outdated (apenas major updates que podem ter breaking changes)
OUTDATED=$(npm outdated --json 2>/dev/null || true)
OUTDATED_COUNT=$(echo "$OUTDATED" | jq -r 'keys | length' 2>/dev/null || echo "0")

if [ "$OUTDATED_COUNT" -gt 0 ] && [ "$OUTDATED_COUNT" != "0" ]; then
  echo -e "  ${YELLOW}ℹ️  $OUTDATED_COUNT dependências com atualizações disponíveis${NC}"
  echo "     Execute 'npm outdated' para detalhes"
else
  echo -e "  ${GREEN}✓ Todas as dependências estão atualizadas${NC}"
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# Resultado Final
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Resultado Final${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

EXIT_CODE=0

# Determinar resultado baseado no modo
if [ "$STRICT_MODE" = true ]; then
  if [ "$TOTAL" -gt 0 ]; then
    echo -e "${RED}❌ FALHA: $TOTAL vulnerabilidades encontradas (modo strict)${NC}"
    EXIT_CODE=1
  fi
else
  # Modo padrão: falha apenas em high/critical
  if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    echo -e "${RED}❌ FALHA: Vulnerabilidades critical ($CRITICAL) ou high ($HIGH) encontradas${NC}"
    EXIT_CODE=1
  fi
fi

if [ "$SENSITIVE_FOUND" = true ]; then
  echo -e "${RED}❌ FALHA: Arquivos sensíveis encontrados no repositório${NC}"
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "${GREEN}✅ PASSOU: Nenhuma vulnerabilidade crítica encontrada${NC}"
fi

echo ""
echo "  Executado em: $(date)"
echo ""

exit $EXIT_CODE
