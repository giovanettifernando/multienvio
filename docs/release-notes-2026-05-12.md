# Release Notes — 12/05/2026

Resumo das alterações entregues neste ciclo, prontas para apresentação em reunião.

---

## 1. Taxa Mínima de Coleta por Coletor

**O que mudou:** Cada coletor agora pode ter uma taxa mínima configurada. Independente do tipo de cobrança (valor fixo ou por km), se o valor calculado for menor que o mínimo, o piso é aplicado automaticamente.

**Impacto no negócio:** Garante que nenhuma coleta seja feita abaixo de um valor mínimo definido pelo operador, protegendo a margem do coletor mesmo em distâncias muito curtas.

**Como funciona:**
- Campo "Taxa mínima (R$)" adicionado dentro da seção **Modelo de Comissão** no formulário do coletor (admin)
- Ao calcular a taxa de coleta de um pedido, o sistema compara o valor calculado com o mínimo e usa o maior
- Funciona para os dois tipos de cobrança: fixo e por km

**Arquivos alterados:**
- `prisma/schema.prisma` — novo campo `pickupFeeMinimum Float?` no model `Collector`
- `platform/db/postgis.ts` — campo incluído nas queries de busca de coletores próximos
- `modules/pickup-points/application/pickupFee.ts` — lógica do piso aplicada no cálculo
- `modules/collectors/application/schemas.ts` — schema do formulário com campo `pickupFee.minimum`
- `modules/collectors/application/types.ts` — tipo `CollectorPickupFee` com campo `minimum`
- `modules/collectors/application/service.ts` — mapeamento no create/update/read do coletor
- `modules/collectors/ui/components/forms/FinanceForm.tsx` — input visível no painel admin
- `modules/collectors/ui/components/CollectorDrawer.tsx` — campo incluído no formulário de criação/edição
- `app/(admin)/admin/coletores/[id]/CollectorDetailClient.tsx` — campo incluído na tela de detalhe do coletor

---

## 2. Correção: Coletores Criados pelo Admin Não Apareciam na Lista

**O que era:** Coletores criados manualmente pelo painel admin ficavam invisíveis na listagem porque o campo `pfEmailVerified` ficava como `false` — o sistema tratava isso como "e-mail não confirmado" e ocultava o registro.

**O que mudou:** Ao criar um coletor pelo admin, `pfEmailVerified` agora é setado como `true` automaticamente, pois a verificação de e-mail não se aplica a cadastros feitos pelo operador.

**Arquivo alterado:**
- `modules/collectors/application/service.ts` — `pfEmailVerified: true` na criação via admin

---

## 3. Correção: Documentos Opcionais no Painel Admin

**O que era:** Ao tentar salvar alterações de um coletor no painel admin, o sistema bloqueava com erros como *"É necessário enviar pelo menos 1 arquivo da CNH"* mesmo quando os documentos já estavam salvos ou não eram obrigatórios naquele contexto.

**O que mudou:** No painel admin (tanto no drawer de criação quanto na tela de detalhe), os documentos — CNH, CRLV e comprovante de endereço — passaram a ser opcionais. A obrigatoriedade continua válida apenas no **cadastro público** feito pelo próprio coletor.

**Arquivos alterados:**
- `modules/collectors/ui/components/CollectorDrawer.tsx` — validação de documentos removida para admin
- `app/(admin)/admin/coletores/[id]/CollectorDetailClient.tsx` — mesma correção na tela de detalhe

---

## 4. Melhoria: Erros de Validação do Formulário Agora São Visíveis

**O que era:** Se o formulário de edição do coletor tivesse algum campo inválido, clicar em "Salvar alterações" não dava nenhum feedback — o botão simplesmente não fazia nada.

**O que mudou:** Um callback `onError` foi adicionado ao `handleSubmit`. Agora, quando há erro de validação, uma mensagem descritiva aparece indicando qual campo está incorreto.

**Arquivo alterado:**
- `app/(admin)/admin/coletores/[id]/CollectorDetailClient.tsx`

---

## 5. Melhoria Visual: Alinhamento de Labels no Formulário PF

**O que era:** No formulário de Pessoa Física (tanto no cadastro público quanto no painel admin), os textos dos labels ficavam alinhados ao **topo** dos inputs, causando desalinhamento visual especialmente nos inputs com altura maior.

**O que mudou:** Labels agora ficam verticalmente centralizados com seus respectivos inputs em todos os formulários horizontais do sistema.

**Arquivo alterado:**
- `app/globals.css` — regra `align-items: center` nos form items horizontais do Ant Design

---

## 6. Melhoria Visual: Alinhamento do Checkbox "Usar mesmo número"

**O que era:** O checkbox "Usar mesmo número para WhatsApp" no formulário PF ficava desalinhado — o texto aparecia abaixo do ícone do checkbox em vez de ao lado.

**O que mudou:** Checkbox reorganizado para ficar corretamente inline com seu texto, posicionado logo abaixo do campo Celular.

**Arquivo alterado:**
- `modules/collectors/ui/components/forms/PFForm.tsx`

---

## 7. Melhoria: Tabbar do Detalhe do Coletor Responsiva

**O que era:** Na tela de detalhe do coletor (`/admin/coletores/[id]`), a tabbar mostrava um botão "..." e escondia algumas abas (como "Pessoa Física") mesmo havendo espaço suficiente na tela, pois os itens tinham tamanhos fixos com muito espaço entre eles.

**O que mudou:** As abas agora se distribuem proporcionalmente ocupando toda a largura disponível. Em telas grandes, todos os itens ficam visíveis sem overflow. Em telas muito pequenas (< 577px), o comportamento scrollável padrão é mantido.

**Arquivos alterados:**
- `app/(admin)/admin/coletores/[id]/CollectorDetailClient.tsx` — `className="collector-detail-tabs"` adicionado ao `<Tabs>`
- `app/globals.css` — regras flex para distribuição proporcional das abas

---

## 8. Assistente Virtual Ocultado

**O que era:** Um widget de chat azul aparecia no rodapé de todas as páginas da área do cliente.

**O que mudou:** O componente `AssistantChat` foi desabilitado temporariamente. Pode ser reativado revertendo o comentário em `shared/ui/providers/app-providers.tsx`.

**Arquivo alterado:**
- `shared/ui/providers/app-providers.tsx`

---

## 9. Tooltip do Valor do Seguro Atualizado

**O que era:** O ícone de interrogação ao lado de "Valor do seguro" na calculadora de frete exibia informações técnicas sobre limites mínimos.

**O que mudou:** Texto alterado para "Valor que será coberto pelo seguro", mais claro para o usuário final.

**Arquivo alterado:**
- `modules/quotes/ui/components/InsuranceInput.tsx`

---

## 10. Novo Campo: Segundo Percentual de Comissão nas Integrações

**O que mudou:** Em todas as integrações de transportadoras (Correios, Loggi e J&T), foi adicionado um segundo campo "Percentual de Comissão (%)" ao lado do campo existente, preparando a estrutura para uma regra de comissionamento adicional a ser definida.

**Arquivos alterados:**
- `app/(admin)/admin/correios/CorreiosClient.tsx`
- `app/(admin)/admin/loggi/LoggiClient.tsx`
- `app/(admin)/admin/jt/JTClient.tsx`

---

## 11. Melhoria: Limite de Volumes por Envio

**O que mudou:** O número máximo de volumes por cotação foi reduzido de 10 para 3. Ao tentar adicionar um 4º volume (manualmente ou via importação), o sistema exibe uma mensagem orientando o usuário a finalizar o envio atual e criar uma nova cotação para os volumes restantes.

**Arquivos alterados:**
- `modules/quotes/ui/components/quoteFormSchema.ts` — `MAX_VOLUMES` alterado para 3
- `modules/quotes/ui/components/QuoteForm.tsx` — mensagens de erro no `handleAddVolume` e `handleImportVolumes`

---

## 12. Melhoria: Aviso de Dimensões Mínimas dos Correios

**O que mudou:** Uma mensagem informativa — *"As dimensões mínimas dos Correios são 15 x 15 x 16 cm"* — foi adicionada acima do botão "Calcular" no painel de resultados da cotação, antes de qualquer cálculo ser feito.

**Arquivo alterado:**
- `modules/quotes/ui/components/QuoteResultsSection.tsx`

---

## 13. Correção: Ponto de Coleta Deixa de Ser Obrigatório

**O que era:** Ao finalizar um pedido, o sistema bloqueava o checkout com o erro *"Selecione um ponto de coleta ou ative a opção de coleta na origem"* mesmo em fluxos onde o ponto de coleta não era aplicável.

**O que mudou:** A obrigatoriedade do ponto de coleta foi removida do checkout. O usuário pode finalizar o pedido sem selecionar um ponto de coleta.

**Arquivo alterado:**
- `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`

---

## Utilitário: Endpoint de Teste para Taxa de Coleta

> *Disponível apenas fora de produção (`APP_ENV !== 'production'`)*

Endpoint `GET /api/test/pickup-fee` criado para verificar o cálculo da taxa de coleta de um coletor específico sem precisar passar pelo fluxo completo de cotação.

**Parâmetros:** `?collector=<id>&frete=<valor>&km=<distancia>`

**Resposta inclui:** tipo da taxa, valor base calculado, se o mínimo foi aplicado, comissão da plataforma e valor final.

**Arquivo adicionado:**
- `app/api/test/pickup-fee/route.ts`
