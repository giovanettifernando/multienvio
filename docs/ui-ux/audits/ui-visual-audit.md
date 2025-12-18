# Auditoria Visual - Envio Legal (remetente, admin, collector, público)

## Resumo geral da aparência atual
- A área do remetente (`app/(envio)`) usa um tema claro com sidebar escura (`components/layout/Sidebar.tsx`) e header azul sólido em `PageShell` (`components/shared/PageShell.module.css`), cards com sombra forte (`components/ui/ELCard.module.css`) e tabelas com cabeçalho em caixa alta. O resultado é funcional, porém denso, com muitos elementos pequenos (fontes 12–13px em tabelas) e contraste irregular entre blocos azuis escuros e cartões claros.
- O admin (`app/(admin)/admin/*`) mantém o padrão Ant Design quase sem overrides (ex.: login em `app/(admin)/admin/login/AdminLoginClient.tsx`, listagens em `components/collectors/CollectorsTable.tsx`), com bordas e tipografia default. Fica visualmente desconectado do remetente: outro tamanho de fonte, radius menor e cores padrão (#1677ff).
- Os ambientes de coleta (`app/(collector)/collector/*` e `app/(public)/coletores/*`) usam headers escuros (#001529) com cards e tabelas default AntD (`app/(collector)/collector/CollectorDashClient.tsx`), sem tokens nem tipografia alinhada. Garante uso, mas parece um produto diferente.
- Telas públicas variam: o login principal (`app/(auth)/auth/login/LoginClient.tsx`) tem gradient e ELCard; o login do coletor público (`app/(public)/coletores/login/LoginColetorClient.tsx`) é um Card AntD cinza; o rastreio público (`app/rastreio/[code]/PublicTrackingClient.tsx`) é um container simples de 800px com textos pequenos. Falta unidade visual.

## Tipografia
- Tokens globais definem base `clamp(14px, 1vw + 12px, 16px)` e títulos fluidos (`app/globals.css`), mas tabelas forçam 12–13px (`components/ui/DataTable.module.css`, `components/ui/ELTableWrapper.module.css`), e o header em caixa alta deixa a hierarquia pesada.
- `ELCard` usa título ~17px/600, `ELStatusTag` e `ELTag` ficam em 12px, `ELButton` 12–13px em breakpoints menores. Admin/collector permanecem com 14px default AntD, gerando saltos de escala entre áreas.
- Uso irregular de pesos: tracking code em `app/(envio)/shipments/ShipmentsClient.tsx` usa 600, subtítulos de tabelas e descrições (ex.: `components/collectors/CollectorsTable.tsx` com `Typography.Text` 12px) ficam desproporcionais. Há bolds pontuais em KPIs (`components/dashboard/ShipmentsStatusBoard.tsx`) sem hierarquia clara.
- Falta consistência entre títulos de página (PageShell h3 branco), títulos de seção (Cards default no admin/collector) e textos de apoio/muted (variam entre 12px e 14px).

## Cores
- Paleta declarada em `app/globals.css`: primária #003873, secundária #E4660C, sucessos #1E8E5A, erro #D64545, info #2B6CB0, neutros bg #F7F8FA/surface #FFF/text #182235. Status têm tints RGBA de 10%.
- Uso inconsistente: vários componentes permanecem com azuis padrão AntD (#1677ff/#1890ff) — ex.: avatar do usuário na sidebar (`components/layout/UserPanel.tsx`), ícones de expandir DataTable (`components/ui/DataTable.tsx`), gráficos/KPIs (`components/dashboard/ShipmentsStatusBoard.tsx`), badges em `components/ui/shipment-status-badge.tsx` usando `Tag` com cores nomeadas.
- Admin e collector adotam tags `color="green/red/blue/gold"` e headers #001529, fugindo das cores semânticas definidas. Tela pública de rastreio não usa o background neutro do app, ficando branca (#fff) com textos escuros.
- Contraste: tags de status pequenas (12px) com tints claros podem perder legibilidade sobre linhas de tabela cinza-claro; botões ghost/icon-only em tabelas competem com texto por falta de hierarquia cromática.

## Espaçamento e proporções
- Tokens de spacing 4/8/12/16/24/32/48 existem, mas há valores fora da escala (6px/10px em `components/ui/ELTableWrapper.module.css`, `components/ui/DataTable.module.css`). Cards usam sombra 0 20px 48px, que pesa em páginas cheias.
- `PageShell` cria bloco azul com padding 16/24 e sticky; somado a cards com sombra alta, a tela parece segmentada. `DashboardShell` define `marginLeft` fixo e `el-container` com padding 16–24, mas páginas de admin/collector não usam o mesmo container, ficando coladas às bordas.
- Tabelas no remetente: padding 12x16 (ou 8x12 em breakpoints), altura de linha baixa e `scrollY="calc(100vh - 340px)"` em `ShipmentsClient`, gerando dupla rolagem em 1366x768. Admin/collector também usam `scrollY calc(100vh - 340px)` (`components/collectors/CollectorsTable.tsx`) sem ajuste de densidade.
- Forms: `ELInput`/`ELButton` têm 36–44px de altura; já no admin/collector os inputs são 32px, criando desalinhamento visual entre produtos. Filtros/ActionBar ocupam pouco respiro lateral, com elementos grudados em cards.

## Componentes-chave
- **Tabelas e grids**: DataTable (`components/ui/DataTable.tsx`) e ELTableWrapper padronizam cabeçalho em caixa alta, fonte 12px e borda inferior a cada linha. Não há zebra striping; hover é mínimo. Colunas não definem largura, causando quebra quando há badges ou textos longos. Ações em `ShipmentsClient` e `components/collectors/CollectorsTable.tsx` concentram muitos botões/ícones lado a lado, deixando a linha poluída.
- **Badges/Status**: Coexistem `ELStatusTag` (pill com tints), `ELTag` e `Tag` AntD. `components/ui/shipment-status-badge.tsx` usa `Tag` com cores nomeadas diferentes do mapa em `ShipmentsClient`. Algumas tags têm texto minúsculo 11–12px e pouco contraste com o fundo da tabela.
- **Cards/Modais**: `ELCard` tem borda e sombra fortes; admin/collector usam `Card` sem estilização, e modais default AntD (login admin/collector) convivem com `ELModal` (padding 24, radius 16). Falta ritmo consistente de cabeçalhos e rodapés.
- **Formulários/Filtros**: No remetente, `ELFormItem/ELInput/ELSelect` aplicam radius 12 e cores brand; filtros em `components/ui/ActionBar.tsx` não têm área destacada nem separadores, parecendo embutidos no card. Admin/collector utilizam `Form`/`Input` padrão e links pequenos, criando outra identidade.
- **Layout**: Sidebar escura com ícones claros no remetente, headers escuros no collector, header branco no admin. `PageShell` sticky azul destaca o título mas não existe nos demais produtos, acentuando a ruptura visual.

## Problemas que deixam a UI datada/poluída
- Cabeçalhos de tabela em caixa alta com fonte 10–12px e pouco espaçamento (DataTable/ELTableWrapper) passam sensação “bruta” e antiga.
- Cartões com sombra muito pronunciada (ELCard) e múltiplos blocos com borda acentuada tornam telas carregadas.
- Ícones desalinhados e excesso de botões ghost nas linhas (`ShipmentsClient`, `CollectorsTable`) reduzem hierarquia e aumentam ruído.
- Uso misto de cores default do AntD (#1677ff/#1890ff) e paleta própria gera aspecto inconsistente e sem branding único (UserPanel, KPIs, badges).
- Falta de respiro em tabelas com `scrollY calc(100vh - 340px)` e paddings pequenos; textos e tags ficam colados.
- Telas públicas (rastreio, logins de coletor) sem o background neutro, tipografia ou tokens de radius/radius do produto, parecendo landing pages genéricas.

## Foco: tela de envios (`app/(envio)/shipments/ShipmentsClient.tsx`)
- **O que está errado hoje**:
  - Tipografia pequena (13px corpo, 12px cabeçalho) e cabeçalho em caixa alta; tracking code e recipient ficam na mesma célula sem hierarquia clara.
  - Badge de status (`ELStatusTag` 12px) empilhada com badge de coleta, deixando a linha densa; botão “Divergência” vermelho dentro da primeira coluna aumenta o peso visual.
  - Espaçamento vertical curto (padding 12px) e `scrollY calc(100vh - 340px)` criam sensação espremida e duas barras de rolagem em telas 1366x768.
  - Colunas sem largura definida fazem ações e valores empurrarem o layout; ações têm 5 botões icon-only iguais em peso, poluindo a leitura.
  - Card de contorno pesado + header azul sticky de `PageShell` geram múltiplos planos de cor e sombra, sem divisão sutil de seções.
- **Como deveria ficar (alinhado ao novo sistema)**:
  - Cabeçalho de tabela em `Title Case`, 12–13px/500, com altura de linha 48px e espaçamento confortável; zebra ou hover mais perceptível para legibilidade.
  - Primeira coluna com tracking code 15–16px/600 e subtítulo (destinatário/cidade) 13px/400 em cor secundária; dividir badges e ações em colunas próprias.
  - Status como pill 13px com tints da paleta e indicador opcional; badge de coleta com cor de info/processing menor e espaçamento de 4–6px.
  - Ações agrupadas: dois botões principais (Detalhes, Etiqueta) visíveis, demais em dropdown/kebab; espaçamento horizontal maior (8–12px) e ícones alinhados.
  - Altura de linha 52–56px, padding 12–16px, `scrollY` calculado por viewport mais seguro ou autosizing com paginação; card com sombra mais suave e borda neutra fina.
