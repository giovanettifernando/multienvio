# Implementação: Seleção de Endereços e Destinatários em /cotacoes

## Resumo

Implementada funcionalidade de seleção de endereços cadastrados (remetente) e destinatários recorrentes em `/cotacoes`, reutilizando toda a infraestrutura existente de `/minha-conta`.

## Arquitetura

### Reutilização de Código Existente

✅ **Sem novos modelos Prisma** - Usa tabelas `addresses` e `recipients` existentes
✅ **Sem novas rotas API** - Usa endpoints `/api/account/addresses` e `/api/account/recipients`
✅ **Sem novos hooks** - Reutiliza `useAddresses`, `useAddressCreate`, `useAccountRecipients`, `useRecipientCreate` de `@/hooks/useAccount`
✅ **Sem novos modais** - Reutiliza `AddressModal` e `RecipientModal` existentes
✅ **Mesma validação/serviço de CEP** - Componente `CepInput` com autocompletar via BrasilAPI

## Componentes Criados/Atualizados

### 1. `AddressSelect.tsx` (components/addresses/)

**Funcionalidades:**
- Lista endereços do usuário via `useAddresses()`
- Select com busca e filtro
- Opção "+ Adicionar novo endereço..." no final da lista
- Empty state com botão CTA quando nenhum endereço cadastrado
- Abre `AddressModal` automaticamente para cadastro
- Após salvar: `invalidateQueries` + seleção automática do novo endereço (optimistic)

**Props:**
```typescript
interface AddressSelectProps {
  value?: string | null; // address ID
  onChange?: (addressId: string | null, address?: Address | undefined) => void;
  onAddAddress?: () => void; // Deprecated (compatibilidade)
  placeholder?: string;
  disabled?: boolean;
}
```

**Formato de exibição:**
```
Label - Rua X, 123 - Complemento - Bairro - Cidade/UF
```

### 2. `RecipientSelect.tsx` (components/recipients/)

**Funcionalidades:**
- Lista destinatários via `useAccountRecipients()` (pageSize: 1000 para buscar todos)
- Select com busca e filtro
- Opção "+ Adicionar novo destinatário..." no final da lista
- Empty state com botão CTA quando nenhum destinatário cadastrado
- Abre `RecipientModal` automaticamente para cadastro
- Após salvar: `invalidateQueries` + seleção automática do novo destinatário (optimistic)

**Props:**
```typescript
interface RecipientSelectProps {
  value?: string | null; // recipient ID
  onChange?: (recipientId: string | null, recipient?: Recipient | undefined) => void;
  onAddRecipient?: () => void; // Deprecated (compatibilidade)
  placeholder?: string;
  disabled?: boolean;
}
```

**Formato de exibição:**
```
Nome do Destinatário - Cidade/UF
```

## Integração no QuoteForm

O `QuoteForm.tsx` já estava usando esses componentes (via zustand store), mas agora foram atualizados para:

1. **Buscar dados da API** ao invés de state local
2. **Abrir modal automaticamente** ao clicar em "+ Adicionar novo..."
3. **Refetch automático** após criar novo endereço/destinatário
4. **Seleção automática** do item recém-criado

## Fluxo de Uso

### Cenário 1: Usuário com Endereços/Destinatários Cadastrados

```
1. Acessa /cotacoes
2. Select "Remetente" já populado com endereços de /minha-conta
3. Select "Destinatário" já populado com destinatários de /minha-conta
4. Seleciona valores e continua o fluxo normalmente
```

### Cenário 2: Usuário SEM Endereços Cadastrados

```
1. Acessa /cotacoes
2. Empty state exibido: "Nenhum endereço cadastrado"
3. Clica em "Cadastrar endereço"
4. Modal AddressModal abre (mesmo de /minha-conta)
5. Preenche CEP → autocomplete logradouro/bairro/cidade/UF
6. Preenche número e complemento
7. Clica em "Adicionar"
8. POST /api/account/addresses
9. Query invalidada → refetch automático
10. Novo endereço selecionado automaticamente no Select
11. Continua o fluxo
```

### Cenário 3: Usuário com Alguns Endereços, Quer Adicionar Novo

```
1. Select já populado com opções existentes
2. Última opção: "+ Adicionar novo endereço..."
3. Clica nessa opção
4. Modal abre → mesmo fluxo do cenário 2
```

## Validações e Regras

### Endereços (AddressModal)

✅ **CEP:** 8 dígitos, máscara `XXXXX-XXX`
✅ **Autocompletar:** Busca CEP via BrasilAPI → preenche e **bloqueia** logradouro/bairro/cidade/UF
✅ **Editáveis:** Apenas número e complemento
✅ **Label/Apelido:** Obrigatório (ex: "Casa", "Trabalho")
✅ **isDefault:** Checkbox opcional

### Destinatários (RecipientModal)

✅ **Nome:** Obrigatório, mínimo 2 caracteres
✅ **CEP:** 8 dígitos, máscara, autocompletar igual a endereços
✅ **Email:** Validação de formato, opcional
✅ **Documento (CPF/CNPJ):** Opcional
✅ **Telefone:** Opcional
✅ **Notas:** Opcional, máximo 280 caracteres

## Arquivos Modificados

### Novos Arquivos Criados

❌ **Nenhum** - Apenas substituídos componentes existentes que usavam zustand por versões que usam React Query + API

### Arquivos Substituídos

1. **`components/addresses/AddressSelect.tsx`**
   - Antes: Usava `useAddressStore` (zustand)
   - Depois: Usa `useAddresses()` + `useAddressCreate()` (React Query)
   - Backup: `AddressSelect.tsx.bak`

2. **`components/recipients/RecipientSelect.tsx`**
   - Antes: Usava `useRecipientsStore` (zustand)
   - Depois: Usa `useAccountRecipients()` + `useRecipientCreate()` (React Query)
   - Backup: `RecipientSelect.tsx.bak`

### Arquivos Corrigidos

3. **`lib/validation/address.ts`**
   - Corrigido `z.enum()` para usar `message` ao invés de `errorMap`

## Endpoints Utilizados

### GET /api/account/addresses

Retorna endereços do usuário autenticado (via session):

```typescript
Response: {
  success: true,
  addresses: Address[]
}
```

### POST /api/account/addresses

Cria novo endereço para o usuário autenticado:

```typescript
Request: {
  label?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault?: boolean;
}

Response: {
  success: true,
  message: "Endereço criado com sucesso",
  address: Address
}
```

### GET /api/account/recipients

Retorna destinatários do usuário autenticado com paginação:

```typescript
Query params: {
  page: number;
  pageSize: number;
  q?: string; // busca
  city?: string;
  uf?: string;
}

Response: {
  items: Recipient[];
  total: number;
  page: number;
  pageSize: number;
}
```

### POST /api/account/recipients

Cria novo destinatário para o usuário autenticado:

```typescript
Request: {
  name: string;
  email?: string | null;
  document?: string | null;
  phone?: string | null;
  notes?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault?: boolean;
}

Response: {
  data: Recipient
}
```

## Segurança

✅ **userId sempre da sessão** - Nenhum endpoint aceita `userId` do cliente
✅ **Autenticação obrigatória** - Todos os endpoints validam sessão via `getUserFromRequest()`
✅ **401 Unauthorized** - Retornado se sessão inválida
✅ **Isolamento de dados** - Cada usuário vê apenas seus próprios endereços/destinatários

## React Query

### Query Keys

```typescript
["account", "addresses"] // Lista de endereços
["account", "recipients", filters] // Lista de destinatários
```

### Invalidation

Após criar novo endereço:
```typescript
queryClient.invalidateQueries({ queryKey: ["account", "addresses"] });
```

Após criar novo destinatário:
```typescript
queryClient.invalidateQueries({ queryKey: ["account", "recipients"] });
```

### Optimistic Update

Após sucesso na criação, o componente:
1. Fecha o modal
2. Aguarda refetch automático (via invalidation)
3. Seleciona o novo item automaticamente via `onChange(newId, newItem)`

## Acessibilidade

✅ **aria-label** nos Selects
✅ **allowClear** para limpar seleção
✅ **showSearch** para busca/filtro
✅ **filterOption** personalizado
✅ **Empty states** com CTAs claros
✅ **Loading states** com Skeleton

## UX/UI

### Estados de Loading

- **Initial load:** Skeleton.Input no lugar do Select
- **Criando endereço/destinatário:** `confirmLoading` no modal

### Estados Vazios

- **Sem endereços:** Empty + botão "Cadastrar endereço"
- **Sem destinatários:** Empty + botão "Cadastrar destinatário"

### Feedback ao Usuário

- ✅ **Sucesso:** `message.success("Endereço salvo com sucesso")`
- ❌ **Erro:** `message.error("Erro ao salvar endereço")`
- ⚠️ **Validação:** Erros inline no formulário

## Testes Recomendados

### Teste 1: Fluxo Completo - Usuário Novo

1. Usuário sem endereços/destinatários cadastrados
2. Acessa `/cotacoes`
3. Empty state exibido em ambos os Selects
4. Cadastra endereço via modal
5. Cadastra destinatário via modal
6. Ambos selecionados automaticamente
7. Continua fluxo de cotação

### Teste 2: Fluxo Completo - Usuário com Dados

1. Usuário já tem endereços/destinatários em `/minha-conta`
2. Acessa `/cotacoes`
3. Selects já populados
4. Seleciona valores existentes
5. Continua fluxo

### Teste 3: Adicionar Novo Durante Cotação

1. Select já populado
2. Clica em "+ Adicionar novo..."
3. Modal abre
4. Cadastra
5. Novo item selecionado automaticamente
6. Continua fluxo

### Teste 4: Validação de CEP

1. Tenta cadastrar com CEP inválido
2. Erro exibido
3. Corrige CEP
4. Autocomplete funciona
5. Campos bloqueados corretamente

## Próximas Melhorias (Opcional)

### 1. Cache Local

Cachear lista de endereços/destinatários por mais tempo:
```typescript
staleTime: 5 * 60 * 1000, // 5 minutos
```

### 2. Edição Inline

Permitir editar endereço/destinatário diretamente do Select (ícone de lápis)

### 3. Favoritos

Marcar endereços/destinatários como favoritos para aparecerem no topo

### 4. Busca Avançada

Filtros adicionais: CEP, UF, cidade

### 5. Bulk Import

Importar múltiplos destinatários via CSV

## Status

✅ **Implementação completa e funcional**
✅ **TypeScript compilando sem erros**
✅ **Reutilização 100% da infraestrutura existente**
✅ **Sem novos modelos/rotas/hooks criados**
✅ **Compatibilidade mantida com QuoteForm**
✅ **Mesma UX de /minha-conta**

## Compatibilidade

### Props Deprecated (Mantidas para Compatibilidade)

```typescript
onAddAddress?: () => void; // AddressSelect
onAddRecipient?: () => void; // RecipientSelect
```

Essas props são **ignoradas** internamente (modal abre automaticamente), mas foram mantidas para não quebrar código existente do `QuoteForm`.
