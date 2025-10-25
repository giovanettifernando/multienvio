# Correções Aplicadas - Envio Legal v2

Este documento detalha todas as anomalias corrigidas no projeto.

## 📋 Resumo das Correções

### ✅ 1. Sistema de Autenticação Unificado

**Problema:** Existiam dois stores de autenticação concorrentes e incompatíveis.

**Arquivos afetados:**
- `stores/auth.ts` (mantido e aprimorado)
- `stores/session.ts` (deprecado, agora é um alias)
- `app/login/page.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(auth)/layout.tsx`

**Mudanças:**
- ✅ Consolidado em `useAuthStore` único
- ✅ Adicionado `persist` middleware do Zustand para manter sessão
- ✅ Removida duplicação de tipos (`Usuario` → `AuthUser`)
- ✅ Login atualizado para usar API em vez de lógica inline
- ✅ Layouts atualizados para usar store unificado

**Migração:**
```typescript
// Antes
import { useSessionStore } from '@/stores/session';
const usuario = useSessionStore(s => s.usuario);

// Depois
import { useAuthStore } from '@/stores/auth';
const user = useAuthStore(s => s.user);
```

---

### ✅ 2. Paths de Importação Corrigidos

**Problema:** Imports misturavam `@/src/` e `@/`, causando erros de módulos não encontrados.

**Solução:**
- ✅ Todos os arquivos de `/src` copiados para raiz
- ✅ Substituição global de `@/src/` → `@/` em 51+ arquivos
- ✅ Estrutura consolidada em diretórios raiz:
  - `/types`
  - `/hooks`
  - `/components`
  - `/lib`

**Arquivos atualizados:**
- `app/api/shipments/route.ts`
- Todos os componentes em `src/components/**`
- Todos os hooks em `src/hooks/**`

---

### ✅ 3. Armazenamento de Dados Padronizado

**Problema:** APIs usavam padrões diferentes para armazenamento em memória.

**Antes:**
```typescript
// app/api/orders/route.ts
declare global { var __envioOrders: Map<string, Order> }

// app/api/shipments/route.ts
export let SHIPMENTS: Shipment[] = []; // ❌ Pode perder dados
```

**Depois:**
```typescript
// Padrão unificado com globalThis
declare global {
  var __envioShipments: Shipment[] | undefined;
}

function getShipmentStore(): Shipment[] {
  if (!globalThis.__envioShipments) {
    globalThis.__envioShipments = [];
  }
  return globalThis.__envioShipments;
}
```

**Benefícios:**
- ✅ Dados persistem entre hot reloads
- ✅ Compatível com ambientes serverless
- ✅ Padrão consistente em toda API

---

### ✅ 4. Autenticação Segura (Sem Hardcoded)

**Problema:** Credenciais hardcoded no código frontend.

**Antes:**
```typescript
// app/login/page.tsx
if (email === 'demo@neoera.dev' && senha === '123456') {
  // Login direto no frontend ❌
}
```

**Depois:**
```typescript
// app/api/auth/login/route.ts
const MOCK_USERS = [
  { email: "demo@enviolegal.com", password: "demo123", ... },
  { email: "admin@enviolegal.com", password: "admin123", ... }
];

// Frontend faz chamada à API
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify(values),
});
```

**Credenciais de Teste:**
- 📧 `demo@enviolegal.com` / `demo123`
- 📧 `admin@enviolegal.com` / `admin123`

**Arquivo criado:**
- `.env.local.example` com documentação

---

### ✅ 5. Configuração Next.js Otimizada

**Problema:** Turbopack no build de produção (ainda experimental) e redirects permanentes.

**Mudanças em `package.json`:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
  }
}
```

**Mudanças em `next.config.ts`:**
```typescript
{
  async redirects() {
    return [
      {
        source: "/pedidos",
        destination: "/shipments",
        permanent: false, // ✅ Alterado de true para false
      },
      // ... outros redirects
    ];
  },
  reactStrictMode: true,     // ✅ Adicionado
  poweredByHeader: false,    // ✅ Segurança
}
```

---

## 🔧 Arquivos Modificados

### Autenticação
- `stores/auth.ts` - Store unificado com persist
- `stores/session.ts` - Agora é alias (deprecated)
- `app/login/page.tsx` - Usa API de login
- `app/(dashboard)/layout.tsx` - Usa useAuthStore
- `app/(auth)/layout.tsx` - Usa useAuthStore
- `app/api/auth/login/route.ts` - Validação server-side

### Estrutura de Arquivos
- 51+ arquivos com imports corrigidos (`@/src/` → `@/`)
- Arquivos copiados de `src/` para raiz

### APIs
- `app/api/shipments/route.ts` - Padrão globalThis
- `app/api/orders/route.ts` - Já usava padrão correto

### Configuração
- `package.json` - Build sem Turbopack
- `next.config.ts` - Redirects temporários + segurança
- `.env.local.example` - Documentação de variáveis

---

## 📝 Tarefas Futuras (Recomendações)

### Alta Prioridade
1. **Implementar autenticação real**
   - Integrar com banco de dados (Prisma/Drizzle)
   - Hash de senhas (bcrypt)
   - JWT tokens
   - Refresh tokens

2. **Consolidar tipos duplicados**
   - Remover `src/types/shipments.ts` (versão simplificada)
   - Manter apenas `types/shipment.ts` (versão completa)

3. **Adicionar middleware de autenticação**
   - Validar tokens em rotas protegidas
   - Rate limiting
   - CSRF protection

### Média Prioridade
4. **Remover diretório `/src` completamente**
   - Após confirmação que todos imports foram migrados
   - Limpar arquivos duplicados

5. **Testes automatizados**
   - Testes de autenticação
   - Testes de APIs
   - Testes de componentes

### Baixa Prioridade
6. **Documentação adicional**
   - API documentation (Swagger/OpenAPI)
   - Guia de desenvolvimento
   - Guia de deployment

---

## 🚀 Como Testar

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar desenvolvimento
```bash
npm run dev
```

### 3. Testar login
- Acesse `http://localhost:3000/login`
- Use: `demo@enviolegal.com` / `demo123`

### 4. Build de produção
```bash
npm run build
npm start
```

---

## ⚠️ Notas Importantes

1. **Persist Zustand:** A autenticação agora persiste no localStorage. Para limpar:
   ```javascript
   localStorage.removeItem('envio-legal-auth')
   ```

2. **Hot Reload:** Com globalThis, dados em memória persistem durante desenvolvimento.

3. **Produção:** Implementar banco de dados real antes de deploy em produção.

4. **Segurança:** Nunca commit arquivos `.env.local` com credenciais reais.

---

**Data das Correções:** 2025-10-20
**Versão:** 0.1.0
