# Correção: Shipments sem Volumes

## 📋 Problema Identificado

**Descrição**: Shipments estavam sendo criados sem volumes (packages) associados, causando inconsistência entre o peso total declarado e a soma dos pesos dos volumes.

**Impacto**:
- 10 shipments sem volumes encontrados (todos com status `ready_for_posting`)
- Inconsistência visual em `/collector/receptions` e `/shipments`
- Violação da regra de negócio: "Todo envio deve ter pelo menos 1 volume"

---

## 🔍 Diagnóstico Completo

### 1. Origem do Problema

**Arquivos afetados**:
- `/app/api/checkout/route.ts` - Criava Shipment sem criar Packages
- `/app/api/cart/checkout/route.ts` - Criava Shipment sem criar Packages

**Fluxo problemático**:
```typescript
// ❌ ANTES: Shipment criado sem volumes
const shipment = await tx.shipment.create({
  data: {
    weight: totalWeight, // Peso calculado manualmente
    // ... outros campos
  },
});
// Volumes NUNCA eram criados na tabela packages!
```

### 2. Dados Afetados

**Query diagnóstica executada**:
```sql
SELECT s.id, s.platformTrackingCode, s.status, s.weight, COUNT(p.id) as volume_count
FROM shipments s
LEFT JOIN packages p ON p.shipmentId = s.id
WHERE s.status != 'cancelled'
GROUP BY s.id
HAVING COUNT(p.id) = 0;
```

**Resultado**: 10 shipments sem volumes
- Status: todos `ready_for_posting`
- Pesos: variando de 1 kg a 20 kg
- Remetente: João Leonardo Giovanetti (teste)

---

## ✅ Solução Implementada

### 1. Serviço Centralizado

**Arquivo criado**: `/lib/shipments/create-with-volumes.ts`

**Função principal**:
```typescript
export async function createShipmentWithVolumes(
  tx: PrismaClient,
  input: CreateShipmentWithVolumesInput
): Promise<{ shipment: any; packages: any[] }>
```

**Invariável de domínio implementada**:
```typescript
// VALIDAÇÃO: Garantir que há pelo menos 1 volume
if (!input.volumes || input.volumes.length === 0) {
  throw new Error('SHIPMENT_REQUIRES_VOLUMES: Um envio deve ter pelo menos 1 volume');
}
```

**Cálculo automático de peso**:
```typescript
// Calcular peso total pela soma dos volumes
const totalWeight = input.volumes.reduce((sum, vol) => sum + vol.peso, 0);

// Shipment SEMPRE criado com peso calculado
const shipment = await tx.shipment.create({
  data: {
    ...input.shipment,
    weight: totalWeight, // Peso calculado automaticamente
  },
});
```

### 2. Endpoints Atualizados

#### `/api/checkout/route.ts`
```typescript
// ✅ DEPOIS: Shipment criado COM volumes
const { shipment, packages } = await createShipmentWithVolumes(tx, {
  shipment: { /* ... */ },
  volumes: data.volumes.map((vol) => ({
    peso: vol.peso,
    altura: vol.altura,
    largura: vol.largura,
    comprimento: vol.comprimento,
  })),
});
```

#### `/api/cart/checkout/route.ts`
```typescript
// ✅ DEPOIS: Shipment criado COM volumes
const { shipment, packages } = await createShipmentWithVolumes(tx, {
  shipment: { /* ... */ },
  volumes: volumes.map((vol) => ({
    peso: vol.pesoKg || 0,
    altura: (vol as { alturaEm?: number }).alturaEm || 0,
    largura: (vol as { larguraEm?: number }).larguraEm || 0,
    comprimento: (vol as { comprimentoEm?: number }).comprimentoEm || 0,
  })),
});
```

### 3. Proteção nos Endpoints de Listagem

#### `/api/collector/receptions/route.ts`
```typescript
const where: Prisma.ShipmentWhereInput = {
  receivedAt: null,
  status: { in: pendingReceptionStatuses },
  // FILTRO CRÍTICO: Apenas shipments que TÊM volumes
  packages: {
    some: {}, // Deve ter pelo menos 1 volume
  },
};
```

#### `/api/shipments/route.ts`
```typescript
const where: Prisma.ShipmentWhereInput = {
  senderId: session.userId,
  // FILTRO CRÍTICO: Apenas shipments que TÊM volumes
  packages: {
    some: {}, // Deve ter pelo menos 1 volume
  },
};
```

### 4. Script de Correção

**Arquivo criado**: `/scripts/fix-shipments-without-volumes.ts`

**Estratégia de correção**:
1. Buscar todos os shipments sem volumes (exceto cancelados)
2. Para cada shipment:
   - Tentar extrair dimensões do campo `document.volumes`
   - Se não houver, usar dimensões padrão (30×20×40 cm)
   - Criar 1 volume com peso do shipment
3. Registrar sucesso/erro de cada correção

**Execução**:
```bash
DATABASE_URL="..." npx tsx scripts/fix-shipments-without-volumes.ts
```

**Resultado**:
```
✅ Shipments corrigidos: 10
❌ Erros: 0
📦 Total processado: 10
🎉 Correção concluída com sucesso!
```

---

## 🛡️ Garantias Implementadas

### 1. Validação Centralizada
- ✅ Função `createShipmentWithVolumes` valida `volumes.length >= 1`
- ✅ Valida peso e dimensões > 0 para cada volume
- ✅ Calcula peso total automaticamente pela soma dos volumes
- ✅ Logs de auditoria em cada criação

### 2. Proteção nas Listagens
- ✅ `/api/collector/receptions` filtra shipments SEM volumes
- ✅ `/api/shipments` filtra shipments SEM volumes
- ✅ Peso total SEMPRE calculado pela soma dos volumes nos endpoints de leitura

### 3. Consistência Visual
- ✅ Peso total na linha do grid = soma dos pesos dos volumes
- ✅ Exemplo com 1 volume: peso total = peso do volume (idênticos)
- ✅ Formatação consistente: `weight.toFixed(1) + " kg"`

---

## 📊 Validação Final

### Testes Realizados

**1. Verificação de shipments sem volumes**:
```bash
✅ Total de Shipments sem volumes: 0
✅ Nenhum shipment sem volumes encontrado!
```

**2. Compilação TypeScript**:
```bash
✅ Nenhum erro de TypeScript
```

**3. Pesos consistentes**:
```typescript
// Backend (route.ts)
const calculatedWeight = shipment.packages.reduce((sum, pkg) => sum + pkg.weight, 0);

// Frontend (page.tsx)
render: (weight) => `${weight.toFixed(1)} kg`, // Grid principal
render: (weight) => weight.toFixed(1),          // Tabela de volumes
```

---

## 📝 Fluxos Corrigidos

### Fluxo de Criação de Shipment

**ANTES**:
```
/cotacoes → Escolher cotação → Finalizar
                                   ↓
                              POST /api/checkout
                                   ↓
                         Shipment.create (SEM volumes)
                                   ↓
                              ❌ PROBLEMA
```

**DEPOIS**:
```
/cotacoes → Escolher cotação → Finalizar
                                   ↓
                              POST /api/checkout
                                   ↓
                    createShipmentWithVolumes(shipment, volumes)
                                   ↓
                         Shipment.create + Package.createMany
                                   ↓
                              ✅ SUCESSO
```

### Fluxo de Listagem

**ANTES**:
```
/collector/receptions → GET /api/collector/receptions
                                   ↓
                     Shipments.findMany() (TODOS, mesmo sem volumes)
                                   ↓
                     weight = shipment.weight (6 kg)
                     volumes[0].weight = (5.5 kg)
                                   ↓
                     ❌ INCONSISTÊNCIA
```

**DEPOIS**:
```
/collector/receptions → GET /api/collector/receptions
                                   ↓
                     Shipments.findMany({ packages: { some: {} } })
                                   ↓
                     weight = sum(packages.weight) (5.5 kg)
                     volumes[0].weight = (5.5 kg)
                                   ↓
                     ✅ CONSISTENTE
```

---

## 🚀 Próximos Passos (Opcional)

### Melhorias Futuras
1. **Constraint no banco**: Adicionar trigger para garantir que todo Shipment tenha >= 1 Package
2. **Testes automatizados**: Criar testes E2E para criação de shipments
3. **Validação no frontend**: Adicionar validação visual antes do submit
4. **Monitoramento**: Alertas caso shipments sem volumes sejam criados

---

## 📚 Referências

- Script de diagnóstico: `/scripts/check-shipments-without-volumes.ts`
- Script de correção: `/scripts/fix-shipments-without-volumes.ts`
- Serviço centralizado: `/lib/shipments/create-with-volumes.ts`
- Endpoints corrigidos:
  - `/app/api/checkout/route.ts`
  - `/app/api/cart/checkout/route.ts`
  - `/app/api/collector/receptions/route.ts`
  - `/app/api/shipments/route.ts`

---

**Data da correção**: 17/11/2025
**Status**: ✅ Concluído e validado
