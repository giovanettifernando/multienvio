# API - Minha Conta / Dados Pessoais

Documentação dos endpoints para gerenciamento de dados pessoais do usuário autenticado.

## Autenticação

Todos os endpoints requerem autenticação via JWT httpOnly cookie.

## Endpoints

### GET /api/account/me

Retorna os dados do usuário autenticado.

**Autenticação**: Requerida (JWT httpOnly)

**Request**:
```http
GET /api/account/me
Cookie: session=<jwt_token>
```

**Response 200 - Sucesso**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "+5511999999999",
    "cpf": "12345678901",
    "avatarUrl": "https://example.com/avatar.jpg",
    "status": "active",
    "emailVerified": true,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Response 401 - Não Autenticado**:
```json
{
  "success": false,
  "message": "Não autenticado",
  "code": "UNAUTHORIZED"
}
```

---

### PUT /api/account/me

Atualiza os dados do usuário autenticado.

**Autenticação**: Requerida (JWT httpOnly)

**Campos Editáveis**:
- `name` - Nome completo (obrigatório, 3-120 caracteres)
- `phone` - Telefone (opcional, será normalizado para E.164)
- `cpf` - CPF (opcional, será validado e salvo sem máscara)
- `avatarUrl` - URL do avatar (opcional)

**Campos NÃO Editáveis**:
- `email` - IMUTÁVEL (retorna erro se enviado)

**Request**:
```http
PUT /api/account/me
Cookie: session=<jwt_token>
Content-Type: application/json

{
  "name": "João Pedro Silva",
  "phone": "(11) 99999-9999",
  "cpf": "123.456.789-01",
  "avatarUrl": "https://example.com/new-avatar.jpg"
}
```

**Response 200 - Sucesso**:
```json
{
  "success": true,
  "message": "Dados atualizados com sucesso",
  "user": {
    "id": "uuid",
    "name": "João Pedro Silva",
    "email": "joao@example.com",
    "phone": "+5511999999999",
    "cpf": "12345678901",
    "avatarUrl": "https://example.com/new-avatar.jpg",
    "status": "active",
    "emailVerified": true,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T15:30:00.000Z"
  }
}
```

**Response 400 - Validação Falhou**:
```json
{
  "success": false,
  "message": "Nome deve ter no mínimo 3 caracteres",
  "code": "INVALID_NAME",
  "errors": [
    {
      "field": "name",
      "message": "Nome deve ter no mínimo 3 caracteres"
    }
  ]
}
```

**Response 400 - Email Imutável**:
```json
{
  "success": false,
  "message": "Email não pode ser alterado",
  "code": "EMAIL_IMMUTABLE",
  "errors": [
    {
      "field": "email",
      "message": "Email não pode ser alterado"
    }
  ]
}
```

**Response 400 - CPF Inválido**:
```json
{
  "success": false,
  "message": "CPF inválido",
  "code": "INVALID_CPF",
  "errors": [
    {
      "field": "cpf",
      "message": "CPF inválido"
    }
  ]
}
```

**Response 400 - Telefone Inválido**:
```json
{
  "success": false,
  "message": "Telefone inválido",
  "code": "INVALID_PHONE",
  "errors": [
    {
      "field": "phone",
      "message": "Telefone inválido"
    }
  ]
}
```

**Response 401 - Não Autenticado**:
```json
{
  "success": false,
  "message": "Não autenticado",
  "code": "UNAUTHORIZED"
}
```

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `UNAUTHORIZED` | Usuário não autenticado |
| `USER_NOT_FOUND` | Usuário não encontrado |
| `INVALID_NAME` | Nome inválido (< 3 ou > 120 caracteres) |
| `INVALID_PHONE` | Telefone em formato inválido |
| `INVALID_CPF` | CPF inválido (checksum falhou) |
| `EMAIL_IMMUTABLE` | Tentativa de alterar email (não permitido) |
| `VALIDATION_ERROR` | Erro genérico de validação |
| `INTERNAL_ERROR` | Erro interno do servidor |

---

## Regras de Validação

### Nome (`name`)
- **Obrigatório**: Sim
- **Mínimo**: 3 caracteres
- **Máximo**: 120 caracteres
- **Processamento**: `trim()` + colapsar espaços múltiplos

**Exemplos Válidos**:
```json
{ "name": "João Silva" }
{ "name": "Maria  Clara  Santos" } // espaços colapsados → "Maria Clara Santos"
```

**Exemplos Inválidos**:
```json
{ "name": "Jo" }  // muito curto
{ "name": "" }    // vazio
```

---

### Telefone (`phone`)
- **Obrigatório**: Não
- **Formato**: Aceita com ou sem máscara
- **Normalização**: Convertido para E.164 (+55...)
- **Validação**: DDD brasileiro (11-99) + 8 ou 9 dígitos

**Exemplos Válidos**:
```json
{ "phone": "(11) 99999-9999" }     // normalizado → "+5511999999999"
{ "phone": "11999999999" }         // normalizado → "+5511999999999"
{ "phone": "+5511999999999" }      // já normalizado
{ "phone": "" }                    // vazio → null
{ "phone": null }                  // null
```

**Exemplos Inválidos**:
```json
{ "phone": "999999999" }      // sem DDD
{ "phone": "(99) 9999-9999" } // DDD inválido
```

---

### CPF (`cpf`)
- **Obrigatório**: Não
- **Formato**: Aceita com ou sem máscara
- **Normalização**: Apenas dígitos (remove máscara)
- **Validação**: Algoritmo de checksum brasileiro

**Exemplos Válidos**:
```json
{ "cpf": "123.456.789-01" }   // normalizado → "12345678901"
{ "cpf": "12345678901" }      // normalizado → "12345678901"
{ "cpf": "" }                 // vazio → null
{ "cpf": null }               // null
```

**Exemplos Inválidos**:
```json
{ "cpf": "111.111.111-11" }   // dígitos repetidos
{ "cpf": "123.456.789-00" }   // checksum inválido
{ "cpf": "12345" }            // comprimento inválido
```

---

### Avatar URL (`avatarUrl`)
- **Obrigatório**: Não
- **Formato**: URL válida
- **Processamento**: `trim()`

**Exemplos Válidos**:
```json
{ "avatarUrl": "https://example.com/avatar.jpg" }
{ "avatarUrl": "" }    // vazio → null
{ "avatarUrl": null }  // null
```

**Exemplos Inválidos**:
```json
{ "avatarUrl": "not-a-url" }  // formato inválido
```

---

### Email (`email`)
- **IMUTÁVEL**: Não pode ser alterado via esta API
- **Rejeição**: Retorna erro `EMAIL_IMMUTABLE` se enviado no body

**Exemplo de Erro**:
```json
// Request
{
  "name": "João Silva",
  "email": "novo@example.com"  // ❌ NÃO PERMITIDO
}

// Response 400
{
  "success": false,
  "message": "Email não pode ser alterado",
  "code": "EMAIL_IMMUTABLE"
}
```

---

## Exemplos de Uso

### Exemplo 1: Atualizar apenas nome
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{
    "name": "João Pedro Silva"
  }'
```

### Exemplo 2: Atualizar nome e telefone
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{
    "name": "João Pedro Silva",
    "phone": "(11) 99999-9999"
  }'
```

### Exemplo 3: Atualizar todos os campos
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{
    "name": "João Pedro Silva",
    "phone": "(11) 99999-9999",
    "cpf": "123.456.789-01",
    "avatarUrl": "https://example.com/avatar.jpg"
  }'
```

### Exemplo 4: Remover campos opcionais (enviar null ou "")
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{
    "name": "João Silva",
    "phone": "",
    "cpf": null,
    "avatarUrl": null
  }'
```

---

## Rate Limiting

- **Limite**: 10 requisições por minuto por IP no endpoint PUT
- **Status**: 429 Too Many Requests
- **Header**: `Retry-After: <seconds>`

---

## Segurança

1. **Autenticação**: JWT httpOnly cookie obrigatório
2. **Autorização**: Usuário só pode acessar seus próprios dados
3. **Validação**: Todos os inputs são validados com Zod
4. **Normalização**: Dados são normalizados antes de salvar
5. **Auditoria**: Campo `updatedAt` atualizado automaticamente

---

## Modelo de Dados (Prisma)

```prisma
model User {
  id                    String    @id @default(uuid())
  name                  String
  email                 String    @unique
  phone                 String?
  cpf                   String?   // CPF sem máscara (apenas números)
  avatarUrl             String?   // URL do avatar
  status                String    @default("pending")
  emailVerified         Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@map("users")
}
```

---

## Testes Manuais

### Teste 1: Buscar dados do usuário
```bash
curl http://localhost:3000/api/account/me \
  -H 'Cookie: session=<your_jwt>'
```

**Esperado**: Retorna dados do usuário (200)

---

### Teste 2: Atualizar apenas nome
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{"name":"Novo Nome"}'
```

**Esperado**: Sucesso (200) com nome atualizado

---

### Teste 3: Tentar alterar email
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{"name":"João","email":"novo@example.com"}'
```

**Esperado**: Erro 400 com código `EMAIL_IMMUTABLE`

---

### Teste 4: Enviar CPF inválido
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{"name":"João","cpf":"111.111.111-11"}'
```

**Esperado**: Erro 400 com código `INVALID_CPF`

---

### Teste 5: Enviar telefone com máscara
```bash
curl -X PUT http://localhost:3000/api/account/me \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=<your_jwt>' \
  -d '{"name":"João","phone":"(11) 99999-9999"}'
```

**Esperado**: Sucesso (200) com phone salvo como `+5511999999999`

---

## Notas de Implementação

1. **CPF**: Validado usando algoritmo de checksum oficial brasileiro
2. **Telefone**: Normalizado para E.164 (+55...) para compatibilidade internacional
3. **Email**: Bloqueado para alteração por segurança (requer fluxo de verificação separado)
4. **Espaços no nome**: Colapsados automaticamente (múltiplos espaços → um espaço)
5. **Campos opcionais**: Enviar `null` ou string vazia limpa o campo no banco
