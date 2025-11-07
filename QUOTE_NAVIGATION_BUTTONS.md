# Implementação: Botões de Navegação Fixos no Fluxo de Cotações

## Resumo

Implementação de botões **Voltar** e **Avançar** fixos na parte inferior de todas as telas do fluxo de cotações (`/cotacoes`), seguindo os requisitos especificados.

## Arquivos Criados

### 1. [components/quote/QuoteNavigationButtons.tsx](components/quote/QuoteNavigationButtons.tsx)

Componente reutilizável que implementa os botões de navegação com todas as funcionalidades especificadas:

**Características:**
- ✅ Container fixo (`position: sticky; bottom: 0`)
- ✅ Estilo usando tokens do Ant Design (`token.colorBgContainer`, `token.colorBorder`)
- ✅ Alinhamento: Voltar à esquerda, Avançar à direita (`justify="space-between"`)
- ✅ Props configuráveis:
  - `onBack` / `onNext`: Callbacks para os botões
  - `disableBack` / `disableNext`: Estados de desabilitação
  - `backLabel` / `nextLabel`: Textos customizáveis
  - `loadingNext`: Loading state no botão Avançar
  - `nextType`: Tipo do botão Avançar (primary/default)
- ✅ **Acessibilidade:**
  - `aria-label="Voltar"` e `aria-label="Avançar"`
  - **Enter** dispara o botão Avançar (se habilitado)
  - **Esc** foca no botão Voltar
  - Listeners de teclado globais com cleanup adequado
- ✅ Ícones: `ArrowLeftOutlined` e `ArrowRightOutlined`
- ✅ Tamanho: `size="large"` em ambos os botões
- ✅ Z-index: 10 para garantir que fique sobre outros elementos

### 2. [components/quote/QuoteNavigationButtons.module.css](components/quote/QuoteNavigationButtons.module.css)

Estilos CSS Module para responsividade mobile-first:

**Mobile (≤768px):**
```css
.quoteNavigationButtons {
  flex-direction: column;
  gap: 8px !important;
}

.quoteNavigationButtons button {
  width: 100% !important;
  min-width: unset !important;
}
```

**Desktop (≥769px):**
```css
.quoteNavigationButtons {
  flex-direction: row;
}
```

## Arquivos Modificados

### 1. [components/quote/QuoteForm.tsx](components/quote/QuoteForm.tsx)

**Mudanças:**
- ✅ Importou `QuoteNavigationButtons`
- ✅ Removeu o botão "Calcular" do layout principal
- ✅ Adicionou o componente `<QuoteNavigationButtons>` após o `</Card>` e dentro do `</Form>`
- ✅ Configuração:
  ```tsx
  <QuoteNavigationButtons
    onNext={handleSubmit(onSubmit)}
    disableNext={!canSubmit}
    loadingNext={calculateQuotes.isPending}
    nextLabel={calculateQuotes.isPending ? "Calculando..." : "Calcular"}
  />
  ```
- ✅ Apenas botão "Avançar" (sem "Voltar" pois é o primeiro passo)
- ✅ Botão desabilitado até o formulário estar válido (`!canSubmit`)
- ✅ Loading state enquanto calcula cotações

### 2. [app/(dashboard)/cotacoes/resultados/page.tsx](app/(dashboard)/cotacoes/resultados/page.tsx)

**Mudanças:**
- ✅ Importou `QuoteNavigationButtons`
- ✅ Adicionou o componente após o `</Flex>` principal
- ✅ Configuração:
  ```tsx
  <QuoteNavigationButtons
    onBack={() => router.push("/cotacoes")}
    backLabel="Editar cotação"
  />
  ```
- ✅ Apenas botão "Voltar" para retornar à tela de cotação
- ✅ Label customizado: "Editar cotação"

### 3. [app/(dashboard)/cotacoes/finalizar/page.tsx](app/(dashboard)/cotacoes/finalizar/page.tsx)

**Mudanças:**
- ✅ Importou `QuoteNavigationButtons`
- ✅ Adicionou o componente após o `</Flex>` principal e antes do `</form>`
- ✅ Configuração:
  ```tsx
  <QuoteNavigationButtons
    onBack={() => router.push("/cotacoes/resultados")}
    backLabel="Ver outros serviços"
  />
  ```
- ✅ Apenas botão "Voltar" para retornar aos resultados
- ✅ Label customizado: "Ver outros serviços"

## Fluxo de Navegação

```
/cotacoes (QuoteForm)
    ↓ [Calcular →]
/cotacoes/resultados
    ↓ [← Editar cotação]
    ↓ [Seleciona serviço]
/cotacoes/finalizar
    ↓ [← Ver outros serviços]
    ↓ [Pagar agora / Adicionar ao carrinho]
/shipments ou /carrinho
```

## Comportamento por Tela

### `/cotacoes` (Formulário de Cotação)
- **Botão Voltar:** Não exibido (primeiro passo)
- **Botão Avançar:**
  - Label: "Calcular" (ou "Calculando..." quando loading)
  - Ação: Submete o formulário e calcula cotações
  - Desabilitado: Quando formulário inválido ou CEPs inválidos
  - Loading: Enquanto `calculateQuotes.isPending`

### `/cotacoes/resultados` (Resultados)
- **Botão Voltar:**
  - Label: "Editar cotação"
  - Ação: Navega para `/cotacoes`
- **Botão Avançar:** Não exibido (seleção acontece na tabela)

### `/cotacoes/finalizar` (Finalização)
- **Botão Voltar:**
  - Label: "Ver outros serviços"
  - Ação: Navega para `/cotacoes/resultados`
- **Botão Avançar:** Não exibido (ações ficam no card de pagamento)

## Acessibilidade

### Atalhos de Teclado
- **Enter:** Dispara o botão "Avançar" (se habilitado)
  - Não dispara se o foco estiver em um `<textarea>`
  - Não dispara se o foco estiver em um `<button>` (evita double trigger)
- **Esc:** Foca no botão "Voltar" (se existir)

### ARIA Labels
- `aria-label="Voltar"` no botão Voltar
- `aria-label="Avançar"` no botão Avançar

### Estados
- Botões desabilitados têm `disabled={true}`
- Loading state visível com spinner no botão

## Design Responsivo

### Mobile (≤768px)
- Botões empilhados verticalmente
- Largura 100% para ambos os botões
- Gap de 8px entre os botões
- Ordem: Voltar no topo, Avançar embaixo

### Desktop (>768px)
- Botões em linha horizontal
- Voltar alinhado à esquerda
- Avançar alinhado à direita
- Largura mínima de 120px cada

## Estilo Visual

### Container
```css
position: sticky;
bottom: 0;
background: token.colorBgContainer; /* Branco ou tema escuro */
border-top: 1px solid token.colorBorder; /* Borda sutil */
padding: 12px 16px;
margin-top: 24px;
z-index: 10;
```

### Botões
- **Tamanho:** `large` (maior clicabilidade)
- **Ícones:**
  - Voltar: `<ArrowLeftOutlined />` à esquerda do texto
  - Avançar: `<ArrowRightOutlined />` à direita do texto
- **Tipo:**
  - Voltar: `default` (secundário)
  - Avançar: `primary` (destaque)

## Integração com Formulários

O componente se integra perfeitamente com React Hook Form:

```tsx
<QuoteNavigationButtons
  onNext={handleSubmit(onSubmit)}  // Submete com validação
  disableNext={!formState.isValid}  // Desabilita se inválido
/>
```

## Notas de Implementação

1. **Não altera layout acima do fold:** Os botões ficam em um container separado após o conteúdo principal, não interferindo no layout existente.

2. **Hooks já existentes:** Utiliza `router.push()` do Next.js para navegação, não requer novos hooks/contextos no wizard.

3. **Estados gerenciados localmente:** Cada página controla seus próprios callbacks e estados de desabilitação.

4. **Sem impacto em funcionalidades existentes:** Os botões de ação específicos (como "Pagar agora" na página de finalização) permanecem inalterados.

## Testes Sugeridos

### Funcionalidade
- [ ] Navegar do formulário até a finalização
- [ ] Botão "Voltar" retorna à tela anterior
- [ ] Botão "Avançar" executa a ação esperada
- [ ] Estados de loading funcionam corretamente
- [ ] Botões desabilitam quando apropriado

### Responsividade
- [ ] Layout mobile (≤768px) empilha botões verticalmente
- [ ] Layout desktop (>768px) alinha botões horizontalmente
- [ ] Botões têm largura 100% em mobile
- [ ] Botões têm largura mínima em desktop

### Acessibilidade
- [ ] Enter dispara botão "Avançar"
- [ ] Esc foca botão "Voltar"
- [ ] Leitores de tela anunciam os labels corretamente
- [ ] Estados disabled são respeitados
- [ ] Tab navigation funciona corretamente

## Status da Implementação

✅ **Concluído** - Todos os requisitos implementados:
- ✅ Componente reutilizável criado
- ✅ Estilo fixo (sticky) no bottom
- ✅ Alinhamento correto (Voltar esquerda, Avançar direita)
- ✅ Integração com hooks/contexto do fluxo
- ✅ Estados de desabilitação implementados
- ✅ Mobile-first responsivo
- ✅ Acessibilidade (aria-label, Enter, Esc)
- ✅ Aplicado em todas as 3 telas do fluxo
- ✅ Sem alteração do layout acima do fold
