# Proposta de Refatoração Visual - Página de Cotações

## Problemas Identificados

### 1. Cores muito saturadas/intensas
- Os cards de **Origem (azul)** e **Destino (verde)** usam `colorInfoBg` e `colorSuccessBg` que são cores muito saturadas
- O resultado visual é "grosseiro" e cansativo para os olhos
- As cores competem pela atenção em vez de guiar o usuário

### 2. Cards muito pesados visualmente
- Background totalmente colorido nos cards cria muito "peso" visual
- Bordas coloridas + background colorido = redundância visual
- Não há respiro/espaço negativo suficiente

### 3. Hierarquia visual confusa
- O título "Configurar envio" compete com os cards coloridos
- Labels como "Endereço selecionado" são pequenas demais
- O toggle "Envio/Logística Reversa" no canto não é intuitivo

### 4. Espaçamento inconsistente
- Padding muito grande nos cards (24px)
- Gap entre cards poderia ser menor

---

## Proposta de Design

### Paleta de Cores Refinada

| Elemento | Atual | Proposto |
|----------|-------|----------|
| Card Origem | `colorInfoBg` (azul saturado) | `#FAFBFC` (cinza muito claro) com borda `#E8ECF0` |
| Card Destino | `colorSuccessBg` (verde saturado) | `#FAFBFC` (cinza muito claro) com borda `#E8ECF0` |
| Ícone Origem | Badge azul grande (40x40) | Ícone pequeno (24px) + texto `primary` |
| Ícone Destino | Badge verde grande (40x40) | Ícone pequeno (24px) + texto `success` |
| Accent | Cores fortes em background | Cores sutis apenas em ícones/chips |

### Estrutura dos Cards

```
┌─────────────────────────────────────────────────────────┐
│  🏢 1) Origem                                           │
│                                                          │
│  Endereço selecionado                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Casa - Rua Juiz José Alfredo... ▼                   ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ○ Solicitar coleta na origem                            │
│    Disponível para CEPs com cobertura                   │
└─────────────────────────────────────────────────────────┘
                          →
┌─────────────────────────────────────────────────────────┐
│  📍 2) Destino                                          │
│                                                          │
│  Como deseja informar o destino?                         │
│  ● Informar manualmente o CEP                           │
│  ○ Selecionar destinatário recorrente                   │
│                                                          │
│  CEP de destino                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 00000-000                                           ││
│  └─────────────────────────────────────────────────────┘│
│  Informe o CEP de quem receberá o envio.               │
└─────────────────────────────────────────────────────────┘
```

### Mudanças Específicas

#### 1. Cards de Rota (`route.css.ts`)
```typescript
// ANTES
background: palette.bg, // azul/verde saturado
border: `1px solid ${palette.border}`,

// DEPOIS
background: token.colorBgContainer, // branco/muito claro
border: `1px solid ${token.colorBorderSecondary}`, // cinza sutil
// Accent apenas no ícone do título
```

#### 2. Badges de Ícones (`OriginCard.tsx`, `DestinationCard.tsx`)
```typescript
// ANTES - Badge grande colorido (40x40)
<div style={{
  width: 40,
  height: 40,
  background: token.colorInfoBg,
  ...
}}>

// DEPOIS - Ícone simples com cor sutil
<span style={{
  fontSize: 18,
  color: token.colorPrimary,
}}>
  <BankOutlined />
</span>
```

#### 3. Layout do Header
```typescript
// ANTES - Toggle no canto direito, título à esquerda
<Flex justify="space-between">
  <Title>Configurar envio</Title>
  <Switch>Reversa</Switch>
</Flex>

// DEPOIS - Tabs ou Segmented Control centralizado no topo
<div style={{ textAlign: 'center', marginBottom: 24 }}>
  <Segmented
    options={['Envio', 'Logística Reversa']}
    value={isReverse ? 'Logística Reversa' : 'Envio'}
    onChange={...}
  />
</div>
```

#### 4. Espaçamento
```typescript
// ANTES
padding: token.paddingLG, // 24px

// DEPOIS
padding: 16, // mais compacto
gap: 16, // entre cards
```

---

## Mockup Visual (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                    ┌─────────────────────────────────┐                   │
│                    │    Envio    │ Logística Reversa │                   │
│                    └─────────────────────────────────┘                   │
│                                                                          │
│  ┌────────────────────────────────┐    ┌────────────────────────────────┐│
│  │ 🏢 1) Origem                   │ →  │ 📍 2) Destino                  ││
│  │                                │    │                                ││
│  │ * Endereço selecionado         │    │ Como deseja informar?          ││
│  │ ┌────────────────────────────┐ │    │ ● Informar CEP manualmente     ││
│  │ │ Casa - Rua Juiz José... ▼ │ │    │ ○ Destinatário recorrente      ││
│  │ └────────────────────────────┘ │    │                                ││
│  │                                │    │ CEP de destino                 ││
│  │ ○ Solicitar coleta na origem  │    │ ┌──────────────────────────┐   ││
│  │   Disponível para CEPs com    │    │ │ 00000-000                │   ││
│  │   cobertura de coleta         │    │ └──────────────────────────┘   ││
│  │                                │    │ Informe o CEP do destinatário ││
│  └────────────────────────────────┘    └────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────────┐    ┌────────────────────────────────────────── │
│  │ Valor do seguro (R$) │    │ Resultados da cotação                     │
│  │ ┌──────────────────┐ │    │                                           │
│  │ │ Opcional         │ │    │  ┌─────────────────────────────────────┐  │
│  │ └──────────────────┘ │    │  │ Preencha os dados e clique em      │  │
│  └──────────────────────┘    │  │ "Calcular cotação"                  │  │
│                               │  └─────────────────────────────────────┘  │
│  ┌─────────────────────────┐ │                                           │
│  │ 📦 Volumes do envio     │ │  [ Calcular cotação ]                     │
│  │ ...                      │ │                                           │
│  └─────────────────────────┘ └────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

1. **`components/shipping/route.css.ts`** - Paleta de cores e estilos dos cards
2. **`components/shipping/OriginCard.tsx`** - Header simplificado
3. **`components/shipping/DestinationCard.tsx`** - Header simplificado
4. **`components/quote/QuoteForm.tsx`** - Substituir Switch por Segmented, ajustar layout

---

## Estimativa de Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cores | Saturadas, cansativas | Neutras, elegantes |
| Peso visual | Pesado | Leve |
| Hierarquia | Confusa | Clara |
| UX Toggle Reversa | Switch no canto | Segmented centralizado |
| Espaçamento | Excessivo | Compacto |

---

## Aprovação

**Aguardando sua aprovação para implementar estas mudanças.**

Posso:
1. Implementar todas as mudanças de uma vez
2. Implementar incrementalmente (cores primeiro, depois layout, etc.)
3. Criar um preview em um componente isolado para validação

Qual abordagem prefere?
