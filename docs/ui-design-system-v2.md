# Design System Visual – Envio Legal v2

## Tipografia
- **Família**: Inter (fallback: "Segoe UI", system). Anti-aliased ativo.
- **Escala recomendada** (remetente, admin, collector e público):
  - `12px / 400` – microcopy, labels compactos, chips auxiliares.
  - `13px / 500` – texto de tabela e badges de status.
  - `14px / 400-500` – corpo padrão em listas e formulários densos.
  - `15-16px / 400-500` – corpo primário e inputs em telas principais.
  - `17-18px / 600` – subtítulos de card/modal.
  - `20px / 600` (H4) – títulos de seções internas.
  - `24px / 600` (H3) – títulos de página (PageShell/Admin).
  - `28-32px / 600` (H2/H1) – hero público ou destaques.
- **Line-height**: 1.4 em corpo, 1.3 em títulos; espaçamento vertical entre seções 12–24px.
- **Uso**:
  - Título de página: 24/600 (ou 28 em hero), cor primária/dark.
  - Título de seção/card: 17–18/600, cor primária 700.
  - Texto de tabela: 13–14; valores numéricos à direita com 500.
  - Texto de apoio/muted: 13/400 com cor neutra 500–600.
  - Evitar caixa alta em cabeçalhos; preferir Title Case.

## Paleta de cores
- **Base** (mantém a essência atual, com tons utilitários):
  - Primária: `#0B4EA3` (500) | hover `#0A3F82` (600) | tint `#E6EEF7`.
  - Secundária/acento: `#E87A1A` (500) | hover `#CC6510` | tint `#FFF1E0`.
  - Neutros: bg `#F7F8FA`, surface `#FFFFFF`, surface-alt `#F2F4F7`, texto `#111827`, texto-sec `#475467`, borda `#D0D5DD`, borda-fraca `#EAECF0`.
- **Estados** (AA/AAA em texto de badge e botões):
  - Sucesso: `#16A34A` | tint `#E9F7EF`.
  - Aviso: `#F59E0B` | tint `#FFF7E0`.
  - Erro: `#DC2626` | tint `#FCE8E8`.
  - Info/Processing: `#2563EB` | tint `#E7EDFF`.
- **Aplicação**:
  - Badges de status: fundo `tint`, texto cor 600 da variante; evitar `Tag` com cores nomeadas.
  - Botões: primário cheio (600), secundário/tonal com fundo `tint`, ghost/text para ações discretas.
  - Links de ação: cor primária 500 com hover 600 e sublinhado em foco.
  - Sidebar/header: usar primária 700 ou neutral 900; ícones/textos em `#E6EEF7`.

## Espaçamento e grid
- **Escala**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (8pt grid).
- **Aplicação por componente**:
  - Cards: padding 16–24, gap interno 8–12, header/rodapé com 12–16.
  - Tabelas: padding de célula 12–16 (linha 52–56px), cabeçalho 14–16 de altura extra.
  - Modais: header/body/footer 16–24 conforme tamanho; espaçamento entre campos 12–16.
  - Filtros/ActionBar: gap 12–16, padding vertical 8–12, inputs com largura mínima 200–240.
  - Formulários: margem entre itens 12–16; grupos em grid 2 colunas (>=1024px) usando múltiplos de 8.
- **Grid**: manter `ELGrid`, mas alinhar variantes a 8pt (gaps sm=8, md=12, lg=16, xl=24); largura máxima por container 1280/1400/1600 já existente.

## Componentes visuais padrão
### Tabelas/Listagens
- Cabeçalho: Title Case, 13px/500, cor texto-sec; remover caixa alta. Linhas 52–56px, padding 12–16.
- Densidade: modo confortável default; modo compacto opcional com 44–48px de linha para 1366px.
- Estados de linha: hover com fundo `surface-alt`, zebra opcional (`surface-alt` a cada outra linha), linha selecionada com borda/tint primário claro.
- Conteúdo: padrão de 2 linhas (valor 14–15/500 + subtítulo 12–13/400 em cor secundária); ellipsis com tooltip para textos longos.
- Ações: limitar a 2 botões principais + dropdown/kebab; alinhar ícones e usar ghost/tonal com radius 8.
- Scroll/paginação: evitar `calc(100vh - 340px)` rígido; usar altura baseada em viewport ou auto com paginação consistente.

### Badges de status
- Formato pill, radius 9999, altura 22–24px, padding 6–10px.
- Texto 12–13/500 em fraseado (sem caixa alta). Ícone opcional apenas para estados críticos.
- Variantes: `success`, `warning`, `danger`, `info`, `processing`, `neutral` usando a paleta proposta.

### Cards
- Radius 12, borda 1px `border-fraca`, sombra suave `0 10px 30px rgba(12, 27, 49, 0.08)`.
- Header: título 17–18/600, subtítulo 14/400 em cor secundária; alinhamento entre títulos/ações consistente.
- Rodapé opcional com borda-top fina e espaçamento 12–16.

### Modais
- Tamanhos: sm 420, md 560, lg 720, xl 960, fullscreen `calc(100vw - 48px)`.
- Header 18/600, body 15–16/400 com padding 20–24, footer com gap 8–12 e fundo `surface-alt`.
- Suporte a tonalidades (danger modal com título/texto danger 600, fundo neutro).

### Filtros/ActionBar
- Barra destacada com fundo `surface-alt` ou tint primário suave, padding 8–12.
- Inputs lado a lado com gap 12–16; colapso para coluna única <768px.
- Botões secundários (ex: “Limpar filtros”) como text/ghost; dropdown de ações extras em mobile/tablet.

### Botões
- Alturas: padrão 40–44px, compacto 36px. Radius 10–12.
- Variantes: primário (cheio), secundário (stroke neutra), tonal (tint primário), ghost/text (sem borda), danger (vermelho cheio).
- Ícones alinhados à esquerda com gap 8; tamanho 16.

## Tonalidade geral da UI
- Atmosfera “SaaS B2B moderno”: fundo neutro claro, cartões com sombra sutil e borda fina, uso moderado de acentos. Evitar blocos sólidos pesados; preferir contrastes suaves entre `background` e `surface-alt`.
- Sidebar e headers podem manter tema dark, mas com primária 700 e textos em `#E6EEF7`; áreas internas sempre em light para consistência entre remetente/admin/collector/público.
- Separadores quase invisíveis (bordas `border-fraca`) e respingos de tint nas barras de filtro/headers de tabela para guiar o olhar sem poluição.

## Aplicação específica à listagem de envios
- Cabeçalho da tabela: 13/500 Title Case, sem caixa alta; background `surface-alt`.
- Colunas:
  - Código de rastreio: 15–16/600 com subtítulo 13/400 (destinatário/cidade) em texto-sec.
  - Transportadora/serviço em 14/500; datas em 13/400 alinhadas à direita.
  - Status: `ELStatusTag` 13px com tints definidos; status de coleta menor (12px) e cor `info/processing`.
  - Frete: alinhamento à direita, 14/600.
- Ações: dois botões principais (Detalhes, Etiqueta) + dropdown para rastreio, coleta, cancelar; usar ghost/tonal com radius 8.
- Layout: linha 52–56px, padding 12–16, zebra/hover suave, paginação clara; evitar botão vermelho dentro da primeira coluna (mover para ações).
