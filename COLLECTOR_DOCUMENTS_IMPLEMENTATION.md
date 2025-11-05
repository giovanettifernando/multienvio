# Implementação de Persistência de Documentos de Coletores

## Resumo

Implementação completa do fluxo de persistência de documentos para coletores autônomos, incluindo upload, validação, e armazenamento no banco de dados com suporte a upsert por tipo de documento.

---

## 🎯 Objetivos Alcançados

✅ Persistir documentos obrigatórios (CNH, CRLV, comprovante de endereço PF) na tabela `collector_documents`
✅ Vincular sempre ao `collectorId` da sessão (NUNCA aceitar id vindo do client)
✅ Suportar upload multipart e JSON com metadados pré-processados
✅ Garantir idempotência por tipo de documento (upsert)
✅ Funcionar no cadastro inicial E na edição posterior
✅ Validação completa com Zod
✅ Logging detalhado de todas operações
✅ Build sem erros

---

## 📊 Mudanças no Schema do Prisma

### Arquivo: `prisma/schema.prisma`

**Campos Adicionados**:
- `url` → Nullable (para suportar storageKey)
- `storageKey` → String opcional (chave no storage S3/local)
- `mimeType` → String opcional (tipo MIME do arquivo)
- `size` → Int opcional (tamanho em bytes)
- `issuedAt` → DateTime opcional (data de emissão do documento)
- `expiresAt` → DateTime opcional (data de vencimento)
- `updatedAt` → DateTime automático

**Constraint Adicionado**:
```prisma
@@unique([collectorId, type])
```

Garante que cada coletor tenha **apenas um documento por tipo**. Uploads subsequentes do mesmo tipo substituem o anterior.

**Migração**:
```bash
DATABASE_URL="..." npx prisma db push --accept-data-loss
```

---

## 🗂️ Arquivos Criados

### 1. `lib/auth/autonomous-collector-session.ts`
**Propósito**: Utilitários para gerenciamento de sessão de coletores autônomos

**Funções Principais**:
- `getAutonomousCollectorSession()` → Obtém sessão do JWT cookie
- `requireAutonomousCollectorSession()` → Exige sessão ou lança erro
- `getCollectorId()` → Extrai apenas o collectorId

**Uso**:
```typescript
const collectorId = await getCollectorId(); // Throws UNAUTHORIZED if not logged in
```

### 2. `lib/storage/collector-documents.ts`
**Propósito**: Storage utility para salvar documentos de coletores no filesystem

**Funções Principais**:
- `persistCollectorDocument(collectorId, file, documentType)` → Salva um arquivo
- `persistCollectorDocuments(collectorId, documents[])` → Salva múltiplos arquivos
- `ensureCollectorUploadDir(collectorId)` → Cria diretório do coletor

**Características**:
- Limite de 10 MB por arquivo
- Sanitização de nomes
- Organização: `/public/uploads/collectors/{collectorId}/{timestamp}-{uuid}-{type}-{filename}.{ext}`
- Retorna: `storageKey`, `originalName`, `publicUrl`, `size`, `mimeType`

### 3. `app/api/coletores/documentos/route.ts`
**Propósito**: API endpoint para upload e persistência de documentos

**Métodos**: `POST /api/coletores/documentos`

**Modes Suportados**:

#### Mode 1: Multipart Upload
Client envia arquivos via FormData:
```typescript
const formData = new FormData();
formData.append('cnh_file', file);
formData.append('cnh_issuedAt', '2024-01-01');
formData.append('cnh_expiresAt', '2029-01-01');

await fetch('/api/coletores/documentos', {
  method: 'POST',
  body: formData,
});
```

#### Mode 2: JSON
Client já fez upload e envia metadados:
```typescript
await fetch('/api/coletores/documentos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documents: [
      {
        type: 'cnh',
        filename: 'cnh.pdf',
        url: 'https://...',
        mimeType: 'application/pdf',
        size: 123456,
        issuedAt: '2024-01-01',
        expiresAt: '2029-01-01',
      }
    ]
  }),
});
```

**Validação com Zod**:
```typescript
type: z.enum(['cnh', 'crlv', 'pf_address_proof'])
filename: z.string()
url: z.string().url().optional()
storageKey: z.string().optional()
mimeType: z.string().optional()
size: z.number().int().positive().optional()
issuedAt: z.string().datetime().optional()
expiresAt: z.string().datetime().optional()
```

**Upsert Logic**:
```typescript
await prisma.collectorDocument.upsert({
  where: {
    collectorId_type: { collectorId, type: 'cnh' }
  },
  create: { collectorId, type: 'cnh', ... },
  update: { filename, url, updatedAt, ... }
});
```

**Códigos de Erro**:
- `401 UNAUTHORIZED` → Sem sessão válida
- `400 VALIDATION_ERROR` → Dados inválidos
- `400 NO_FILES` → Nenhum arquivo enviado
- `400 UPLOAD_ERROR` → Erro no upload (tamanho, tipo, etc)
- `500 SERVER_ERROR` → Erro interno

### 4. `test-collector-documents.js`
**Propósito**: Script de teste para validar fluxo de persistência

**Testes**:
- Lista documentos existentes no banco
- Agrupa documentos por coletor
- Identifica coletores sem documentos
- Documenta o fluxo esperado

**Execução**:
```bash
DATABASE_URL="..." node test-collector-documents.js
```

---

## 🔄 Arquivos Modificados

### 1. `app/api/coletores/auth/register/route.ts`
**Mudança**: Adicionada lógica para salvar documentos durante o cadastro

**Implementação**:
```typescript
// Após criar coletor e credenciais
if (validatedData.documents) {
  const documentsToSave = [];

  // Processar CNH files
  for (const file of validatedData.documents.cnhFiles) {
    if (file.url) {
      documentsToSave.push({
        type: 'cnh',
        filename: file.name,
        url: file.url,
      });
    }
  }

  // CRLV e Address Proof...

  await prisma.collectorDocument.createMany({
    data: documentsToSave.map(doc => ({
      collectorId: collector.id,
      type: doc.type,
      filename: doc.filename,
      url: doc.url,
    })),
    skipDuplicates: true,
  });
}
```

**Comportamento**:
- Não falha o registro se documentos falharem
- Logs detalhados: `[register] DOCUMENTS_SAVED`, `[register] DOCUMENTS_SAVE_ERROR`

### 2. `app/(public)/coletores/cadastro/page.tsx`
**Mudança**: Correção de tipos para `url` (de `string | null` para `string | undefined`)

**Antes**:
```typescript
url: file.url,  // Could be null
```

**Depois**:
```typescript
url: file.url || undefined,  // Always string | undefined
```

### 3. `lib/collectors/service.ts`
**Mudança**: Mesma correção de tipos ao mapear documentos do banco

```typescript
url: doc.url || undefined,  // Prisma retorna null, convertemos para undefined
```

---

## 🔐 Segurança

### Autenticação
- ✅ JWT obrigatório em `/api/coletores/documentos`
- ✅ `collectorId` SEMPRE extraído da sessão (nunca do client)
- ✅ Cookie httpOnly com 7 dias de expiração

### Validação
- ✅ Tamanho máximo: 10 MB por arquivo
- ✅ Tipos permitidos via enum: `cnh`, `crlv`, `pf_address_proof`
- ✅ Sanitização de nomes de arquivo
- ✅ Validação com Zod

### Logging
- ✅ Logs apenas IDs e tipos (não conteúdo sensível)
- ✅ Códigos de evento: `UNAUTHORIZED`, `VALIDATION_ERROR`, `UPLOAD_ERROR`, etc.
- ✅ Formato: `[documentos] EVENT: Description`

---

## 📋 Fluxo de Documentos

### Durante o Cadastro (Sem Sessão)
```
1. User preenche formulário /coletores/cadastro
2. Frontend faz upload dos arquivos (CNH, CRLV, Address Proof) → obtém URLs
3. Frontend envia POST /api/coletores/auth/register com todos dados + URLs
4. Backend:
   - Cria collector (status: BLOCKED)
   - Cria credential (passwordHash)
   - Cria documents com URLs fornecidas
   - Envia email de verificação
5. User verifica email → status muda para INACTIVE
6. Admin aprova → status muda para ACTIVE
```

### Após Login (Com Sessão)
```
1. User faz login → recebe JWT cookie
2. User acessa área de documentos
3. User faz upload de novo documento ou atualiza existente
4. Frontend envia POST /api/coletores/documentos (multipart OU JSON)
5. Backend:
   - Extrai collectorId do JWT
   - Valida arquivos/dados
   - Salva arquivos no storage
   - UPSERT no banco (cria ou atualiza por type)
6. Frontend recebe documentos salvos e atualiza UI
```

---

## 🧪 Testes

### Teste 1: Verificar Estado do Banco
```bash
DATABASE_URL="..." node test-collector-documents.js
```

**Output Esperado**:
- Lista de documentos existentes
- Documentos agrupados por coletor
- Coletores sem documentos

### Teste 2: Upload Multipart
```bash
curl -X POST http://localhost:3000/api/coletores/documentos \
  -H "Cookie: coletor-token=..." \
  -F "cnh_file=@cnh.pdf" \
  -F "cnh_issuedAt=2024-01-01" \
  -F "cnh_expiresAt=2029-01-01"
```

**Esperado**: 200 OK com documentos salvos

### Teste 3: Upload JSON
```bash
curl -X POST http://localhost:3000/api/coletores/documentos \
  -H "Cookie: coletor-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [{
      "type": "cnh",
      "filename": "cnh.pdf",
      "url": "https://example.com/cnh.pdf",
      "mimeType": "application/pdf",
      "size": 123456
    }]
  }'
```

**Esperado**: 200 OK com documentos salvos

### Teste 4: Sem Autenticação
```bash
curl -X POST http://localhost:3000/api/coletores/documentos \
  -H "Content-Type: application/json" \
  -d '{"documents": []}'
```

**Esperado**: 401 UNAUTHORIZED

### Teste 5: Upsert (Substituir Documento Existente)
1. Upload CNH pela primeira vez → cria documento
2. Upload CNH novamente → atualiza documento (mesmo ID)
3. Verificar no banco: apenas 1 registro de CNH por coletor

---

## 📁 Estrutura de Arquivos no Storage

```
/public/uploads/collectors/
  ├── {collectorId}/
  │   ├── {timestamp}-{uuid}-cnh-{filename}.{ext}
  │   ├── {timestamp}-{uuid}-crlv-{filename}.{ext}
  │   └── {timestamp}-{uuid}-pf_address_proof-{filename}.{ext}
```

**Exemplo**:
```
/public/uploads/collectors/
  └── cm12345abcdef/
      ├── 1699999999999-a1b2c3d4-cnh-carteira.pdf
      ├── 1699999999999-e5f6g7h8-crlv-veiculo.pdf
      └── 1699999999999-i9j0k1l2-pf_address_proof-comprovante.pdf
```

---

## 🔍 Consultas SQL Úteis

### Ver todos os documentos de um coletor
```sql
SELECT * FROM collector_documents
WHERE "collectorId" = 'cm...'
ORDER BY type;
```

### Coletores sem documentos
```sql
SELECT c.id, c."pfNome", c."pfEmail", c.status
FROM collectors c
LEFT JOIN collector_documents d ON c.id = d."collectorId"
WHERE d.id IS NULL;
```

### Contar documentos por tipo
```sql
SELECT type, COUNT(*)
FROM collector_documents
GROUP BY type;
```

### Documentos duplicados (não deveria existir com unique constraint)
```sql
SELECT "collectorId", type, COUNT(*) as count
FROM collector_documents
GROUP BY "collectorId", type
HAVING COUNT(*) > 1;
```

---

## ✅ Checklist de Implementação

- [x] Schema Prisma atualizado com novos campos
- [x] Unique constraint `@@unique([collectorId, type])` adicionado
- [x] Migração aplicada com `prisma db push`
- [x] Util `autonomous-collector-session.ts` criado
- [x] Util `collector-documents.ts` criado
- [x] API route `/api/coletores/documentos` criada
- [x] Suporte multipart implementado
- [x] Suporte JSON implementado
- [x] Validação Zod implementada
- [x] Upsert logic implementada
- [x] Register route atualizada para salvar documentos
- [x] Service.ts corrigido para tipos compatíveis
- [x] Cadastro page corrigida para tipos compatíveis
- [x] Script de teste criado
- [x] Build sem erros
- [x] Documentação completa

---

## 🚀 Próximos Passos (Opcional)

1. **Frontend de Edição de Documentos**
   - Criar página `/coletores/perfil/documentos`
   - Permitir visualização e upload de novos documentos
   - Mostrar status de cada documento (pendente, aprovado, rejeitado)

2. **Aprovação de Documentos pelo Admin**
   - Adicionar campo `status` em `CollectorDocument` (pending, approved, rejected)
   - Interface admin para revisar documentos
   - Notificação ao coletor sobre status

3. **Validação Adicional**
   - OCR para validar dados da CNH
   - Verificação de autenticidade de documentos
   - Data de vencimento automática

4. **Storage S3**
   - Migrar de filesystem local para S3
   - Gerar URLs assinadas temporárias
   - Implementar CDN para acesso rápido

5. **Compressão de Imagens**
   - Reduzir tamanho de arquivos antes de salvar
   - Gerar thumbnails para preview
   - Converter para formato otimizado (WebP)

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verificar logs do console: `[documentos]`, `[register]`
2. Executar script de teste: `node test-collector-documents.js`
3. Verificar schema do Prisma está sincronizado: `npx prisma db push`
4. Confirmar cookie de sessão existe: DevTools → Application → Cookies → `coletor-token`

---

**Implementação concluída com sucesso!** ✅
