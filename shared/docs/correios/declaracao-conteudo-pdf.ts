/**
 * Gerador de PDF da Declaração de Conteúdo dos Correios
 *
 * Gera PDF no padrão oficial dos Correios para envios com declaração de conteúdo.
 * Usa pdf-lib para geração programática sem dependência de navegador.
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import { formatCPF, formatCNPJ, formatCEP } from '@/shared/utils/masks';
import { formatCurrencyBRL } from '@/shared/utils/format';

// ============================================================================
// TIPOS
// ============================================================================

export interface DeclaracaoConteudoRemetente {
  nome: string;
  documento: string | null;
  endereco: string;
  cidadeUf: string;
  cep: string;
}

export interface DeclaracaoConteudoDestinatario {
  nome: string;
  documento: string | null;
  endereco: string;
  cidadeUf: string;
  cep: string;
}

export interface DeclaracaoConteudoItem {
  descricao: string;
  quantidade: number;
  valor: number;
}

export interface DeclaracaoConteudoPayload {
  remetente: DeclaracaoConteudoRemetente;
  destinatario: DeclaracaoConteudoDestinatario;
  itens: DeclaracaoConteudoItem[];
  pesoTotalKg: number;
}

// ============================================================================
// HELPERS DE FORMATAÇÃO
// ============================================================================

/**
 * Formata peso em kg no padrão brasileiro
 */
export function formatPesoKg(kg: number): string {
  return `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

/**
 * Formata documento (CPF ou CNPJ) automaticamente
 */
export function formatDocumentoBR(documento: string | null): string {
  if (!documento) return '—';
  const digits = documento.replace(/\D/g, '');
  if (digits.length === 11) return formatCPF(digits);
  if (digits.length === 14) return formatCNPJ(digits);
  return documento;
}

// ============================================================================
// CONSTANTES DO LAYOUT
// ============================================================================

const PAGE_WIDTH = 595.28; // A4 em pontos
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 30;
const MARGIN_RIGHT = 30;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Cores
const COLOR_BLACK = rgb(0, 0, 0);
const COLOR_GRAY_HEADER = rgb(0.9, 0.9, 0.9); // #E5E5E5
const COLOR_BLUE_CORREIOS = rgb(0, 0.22, 0.45); // #003873

// Fontes
const FONT_SIZE_TITLE = 18;
const FONT_SIZE_SECTION_HEADER = 10;
const FONT_SIZE_LABEL = 9;
const FONT_SIZE_VALUE = 9;
const FONT_SIZE_TEXT = 8;
const FONT_SIZE_SMALL = 7;

// Textos oficiais
const TEXTO_DECLARACAO_1 = `Declaro, não ser pessoa física ou jurídica, que realize, com habitualidade ou em volume que caracterize intuito comercial, operações de circulação de mercadoria, ainda que estas se iniciem no exterior, que o conteúdo declarado não está sujeito à tributação, e que sou o único responsável por eventuais penalidades ou danos decorrentes de informações inverídicas.`;

const TEXTO_DECLARACAO_2 = `Declaro ainda que não estou postando conteúdo inflamável, explosivo, causador de combustão espontânea, tóxico, corrosivo, gás ou qualquer outro conteúdo que constitua perigo, conforme o art. 13 da Lei Postal nº 6.538/78.`;

const TEXTO_ATENCAO = `Atenção: O declarante/remetente é responsável exclusivamente pelas informações declaradas.`;

const TEXTO_OBS_1 = `É Contribuinte de ICMS qualquer pessoa física ou jurídica, que realize, com habitualidade ou em volume que caracterize intuito comercial, operações de circulação de mercadoria ou prestações de serviços de transportes interestadual e intermunicipal e de comunicação, ainda que as operações e prestações se iniciem no exterior (Lei iComplementar nº 87/96 Art. 4º).`;

const TEXTO_OBS_2 = `Constitui crime contra a ordem tributária suprimir ou reduzir tributo, ou contribuição social e qualquer acessório (Lei 8.137/90 Art. 1º, V).`;

// ============================================================================
// FUNÇÕES AUXILIARES DE DESENHO
// ============================================================================

interface DrawContext {
  page: PDFPage;
  helvetica: PDFFont;
  helveticaBold: PDFFont;
  yPosition: number;
}

/**
 * Desenha uma linha horizontal
 */
function drawLine(ctx: DrawContext, x1: number, x2: number, y: number, thickness = 0.5) {
  ctx.page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color: COLOR_BLACK,
  });
}

/**
 * Desenha um retângulo com borda
 */
function drawRect(
  ctx: DrawContext,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: { fill?: typeof COLOR_BLACK; borderWidth?: number }
) {
  const { fill, borderWidth = 0.5 } = options || {};

  if (fill) {
    ctx.page.drawRectangle({
      x,
      y,
      width,
      height,
      color: fill,
    });
  }

  ctx.page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: COLOR_BLACK,
    borderWidth,
  });
}

/**
 * Quebra texto em múltiplas linhas para caber na largura especificada
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================================================
// SEÇÕES DO PDF
// ============================================================================

/**
 * Desenha o cabeçalho com logo e título
 */
function drawHeader(ctx: DrawContext, logoPngBytes: Uint8Array | null): number {
  const startY = PAGE_HEIGHT - MARGIN_TOP;
  let y = startY;

  // Logo Correios (se disponível)
  if (logoPngBytes) {
    // O logo será embutido no PDF - por enquanto usamos texto
  }

  // Texto "Correios" como fallback
  ctx.page.drawText('Correios', {
    x: MARGIN_LEFT,
    y: y - 20,
    size: 24,
    font: ctx.helveticaBold,
    color: COLOR_BLUE_CORREIOS,
  });

  // Título "Declaração de Conteúdo"
  const titulo = 'Declaração de Conteúdo';
  const tituloWidth = ctx.helveticaBold.widthOfTextAtSize(titulo, FONT_SIZE_TITLE);
  ctx.page.drawText(titulo, {
    x: PAGE_WIDTH - MARGIN_RIGHT - tituloWidth,
    y: y - 20,
    size: FONT_SIZE_TITLE,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });

  return startY - 40;
}

/**
 * Desenha bloco de remetente ou destinatário
 */
function drawPessoaBlock(
  ctx: DrawContext,
  y: number,
  tipo: 'REMETENTE' | 'DESTINATÁRIO',
  pessoa: DeclaracaoConteudoRemetente | DeclaracaoConteudoDestinatario
): number {
  const rowHeight = 18;
  const labelWidth = 80;
  const startY = y;

  // Linha 1: Nome
  drawRect(ctx, MARGIN_LEFT, y - rowHeight, CONTENT_WIDTH, rowHeight);
  ctx.page.drawText(`${tipo}:`, {
    x: MARGIN_LEFT + 4,
    y: y - rowHeight + 5,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText(pessoa.nome || '—', {
    x: MARGIN_LEFT + labelWidth,
    y: y - rowHeight + 5,
    size: FONT_SIZE_VALUE,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });
  y -= rowHeight;

  // Linha 2: CPF/CNPJ
  drawRect(ctx, MARGIN_LEFT, y - rowHeight, CONTENT_WIDTH, rowHeight);
  ctx.page.drawText('CPF/CNPJ:', {
    x: MARGIN_LEFT + 4,
    y: y - rowHeight + 5,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText(formatDocumentoBR(pessoa.documento), {
    x: MARGIN_LEFT + labelWidth,
    y: y - rowHeight + 5,
    size: FONT_SIZE_VALUE,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });
  y -= rowHeight;

  // Linha 3: Endereço
  drawRect(ctx, MARGIN_LEFT, y - rowHeight, CONTENT_WIDTH, rowHeight);
  ctx.page.drawText('ENDEREÇO:', {
    x: MARGIN_LEFT + 4,
    y: y - rowHeight + 5,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText(pessoa.endereco || '—', {
    x: MARGIN_LEFT + labelWidth,
    y: y - rowHeight + 5,
    size: FONT_SIZE_VALUE,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });
  y -= rowHeight;

  // Linha 4: Cidade/UF + CEP (dividida em 2 colunas)
  const cidadeWidth = CONTENT_WIDTH * 0.65;
  const cepWidth = CONTENT_WIDTH - cidadeWidth;

  // Cidade/UF
  drawRect(ctx, MARGIN_LEFT, y - rowHeight, cidadeWidth, rowHeight);
  ctx.page.drawText('CIDADE/UF:', {
    x: MARGIN_LEFT + 4,
    y: y - rowHeight + 5,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText(pessoa.cidadeUf || '—', {
    x: MARGIN_LEFT + labelWidth,
    y: y - rowHeight + 5,
    size: FONT_SIZE_VALUE,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });

  // CEP
  drawRect(ctx, MARGIN_LEFT + cidadeWidth, y - rowHeight, cepWidth, rowHeight);
  ctx.page.drawText('CEP:', {
    x: MARGIN_LEFT + cidadeWidth + 4,
    y: y - rowHeight + 5,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText(formatCEP(pessoa.cep || ''), {
    x: MARGIN_LEFT + cidadeWidth + 40,
    y: y - rowHeight + 5,
    size: FONT_SIZE_VALUE,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });
  y -= rowHeight;

  return y;
}

/**
 * Desenha tabela de identificação dos bens
 */
function drawTabelaBens(
  ctx: DrawContext,
  y: number,
  itens: DeclaracaoConteudoItem[],
  pesoTotalKg: number
): number {
  const headerHeight = 20;
  const rowHeight = 16;
  const colItem = 40;
  const colQuant = 60;
  const colValor = 80;
  const colConteudo = CONTENT_WIDTH - colItem - colQuant - colValor;

  // Header "IDENTIFICAÇÃO DOS BENS"
  drawRect(ctx, MARGIN_LEFT, y - headerHeight, CONTENT_WIDTH, headerHeight, { fill: COLOR_GRAY_HEADER });
  const headerText = 'I D E N T I F I C A Ç Ã O   D O S   B E N S';
  const headerTextWidth = ctx.helveticaBold.widthOfTextAtSize(headerText, FONT_SIZE_SECTION_HEADER);
  ctx.page.drawText(headerText, {
    x: MARGIN_LEFT + (CONTENT_WIDTH - headerTextWidth) / 2,
    y: y - headerHeight + 6,
    size: FONT_SIZE_SECTION_HEADER,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  y -= headerHeight;

  // Subheader com nomes das colunas
  const subHeaderHeight = 16;
  let x = MARGIN_LEFT;

  // ITEM
  drawRect(ctx, x, y - subHeaderHeight, colItem, subHeaderHeight);
  ctx.page.drawText('ITEM', {
    x: x + 4,
    y: y - subHeaderHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  x += colItem;

  // CONTEÚDO
  drawRect(ctx, x, y - subHeaderHeight, colConteudo, subHeaderHeight);
  ctx.page.drawText('CONTEÚDO', {
    x: x + 4,
    y: y - subHeaderHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  x += colConteudo;

  // QUANT.
  drawRect(ctx, x, y - subHeaderHeight, colQuant, subHeaderHeight);
  ctx.page.drawText('QUANT.', {
    x: x + 4,
    y: y - subHeaderHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  x += colQuant;

  // VALOR
  drawRect(ctx, x, y - subHeaderHeight, colValor, subHeaderHeight);
  ctx.page.drawText('VALOR', {
    x: x + 4,
    y: y - subHeaderHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  y -= subHeaderHeight;

  // Linhas de itens
  let totalQuantidade = 0;
  let totalValor = 0;

  // Garantir pelo menos 5 linhas vazias para itens
  const minRows = Math.max(5, itens.length);

  for (let i = 0; i < minRows; i++) {
    const item = itens[i];
    x = MARGIN_LEFT;

    // ITEM (número)
    drawRect(ctx, x, y - rowHeight, colItem, rowHeight);
    if (item) {
      ctx.page.drawText(String(i + 1), {
        x: x + 4,
        y: y - rowHeight + 4,
        size: FONT_SIZE_VALUE,
        font: ctx.helvetica,
        color: COLOR_BLACK,
      });
    }
    x += colItem;

    // CONTEÚDO
    drawRect(ctx, x, y - rowHeight, colConteudo, rowHeight);
    if (item) {
      const descricao = item.descricao.substring(0, 50); // Truncar se muito longo
      ctx.page.drawText(descricao, {
        x: x + 4,
        y: y - rowHeight + 4,
        size: FONT_SIZE_VALUE,
        font: ctx.helvetica,
        color: COLOR_BLACK,
      });
    }
    x += colConteudo;

    // QUANT.
    drawRect(ctx, x, y - rowHeight, colQuant, rowHeight);
    if (item) {
      ctx.page.drawText(String(item.quantidade), {
        x: x + 4,
        y: y - rowHeight + 4,
        size: FONT_SIZE_VALUE,
        font: ctx.helvetica,
        color: COLOR_BLACK,
      });
      totalQuantidade += item.quantidade;
    }
    x += colQuant;

    // VALOR
    drawRect(ctx, x, y - rowHeight, colValor, rowHeight);
    if (item) {
      ctx.page.drawText(formatCurrencyBRL(item.valor), {
        x: x + 4,
        y: y - rowHeight + 4,
        size: FONT_SIZE_VALUE,
        font: ctx.helvetica,
        color: COLOR_BLACK,
      });
      totalValor += item.valor;
    }

    y -= rowHeight;
  }

  // Linha TOTAIS
  x = MARGIN_LEFT;

  // Células vazias mescladas para "TOTAIS"
  const totaisLabelWidth = colItem + colConteudo;
  drawRect(ctx, x, y - rowHeight, totaisLabelWidth, rowHeight);
  const totaisText = 'TOTAIS';
  const totaisTextWidth = ctx.helveticaBold.widthOfTextAtSize(totaisText, FONT_SIZE_LABEL);
  ctx.page.drawText(totaisText, {
    x: x + totaisLabelWidth - totaisTextWidth - 8,
    y: y - rowHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  x += totaisLabelWidth;

  // Total QUANT.
  drawRect(ctx, x, y - rowHeight, colQuant, rowHeight);
  ctx.page.drawText(String(totalQuantidade), {
    x: x + 4,
    y: y - rowHeight + 4,
    size: FONT_SIZE_VALUE,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  x += colQuant;

  // Total VALOR
  drawRect(ctx, x, y - rowHeight, colValor, rowHeight);
  ctx.page.drawText(formatCurrencyBRL(totalValor), {
    x: x + 4,
    y: y - rowHeight + 4,
    size: FONT_SIZE_VALUE,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  y -= rowHeight;

  // Linha PESO TOTAL (kg)
  x = MARGIN_LEFT;
  drawRect(ctx, x, y - rowHeight, totaisLabelWidth, rowHeight);
  const pesoLabel = 'PESO TOTAL (kg)';
  const pesoLabelWidth = ctx.helveticaBold.widthOfTextAtSize(pesoLabel, FONT_SIZE_LABEL);
  ctx.page.drawText(pesoLabel, {
    x: x + totaisLabelWidth - pesoLabelWidth - 8,
    y: y - rowHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  x += totaisLabelWidth;

  // Peso total (ocupa as duas últimas colunas)
  drawRect(ctx, x, y - rowHeight, colQuant + colValor, rowHeight);
  ctx.page.drawText(formatPesoKg(pesoTotalKg), {
    x: x + 4,
    y: y - rowHeight + 4,
    size: FONT_SIZE_VALUE,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  y -= rowHeight;

  return y;
}

/**
 * Desenha bloco de declaração
 */
function drawDeclaracao(ctx: DrawContext, y: number): number {
  const headerHeight = 18;
  const padding = 8;
  const lineHeight = 10;

  // Header "DECLARAÇÃO"
  drawRect(ctx, MARGIN_LEFT, y - headerHeight, CONTENT_WIDTH, headerHeight, { fill: COLOR_GRAY_HEADER });
  const headerText = 'DECLARAÇÃO';
  const headerTextWidth = ctx.helveticaBold.widthOfTextAtSize(headerText, FONT_SIZE_SECTION_HEADER);
  ctx.page.drawText(headerText, {
    x: MARGIN_LEFT + (CONTENT_WIDTH - headerTextWidth) / 2,
    y: y - headerHeight + 5,
    size: FONT_SIZE_SECTION_HEADER,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  y -= headerHeight;

  // Calcular altura do texto
  const textWidth = CONTENT_WIDTH - 2 * padding;
  const lines1 = wrapText(TEXTO_DECLARACAO_1, ctx.helvetica, FONT_SIZE_TEXT, textWidth);
  const lines2 = wrapText(TEXTO_DECLARACAO_2, ctx.helvetica, FONT_SIZE_TEXT, textWidth);
  const totalLines = lines1.length + lines2.length + 1; // +1 para espaço entre parágrafos
  const textBlockHeight = totalLines * lineHeight + 2 * padding + 40; // +40 para data e assinatura

  // Caixa de texto
  drawRect(ctx, MARGIN_LEFT, y - textBlockHeight, CONTENT_WIDTH, textBlockHeight);

  // Desenhar texto
  let textY = y - padding - lineHeight;
  for (const line of lines1) {
    ctx.page.drawText(line, {
      x: MARGIN_LEFT + padding,
      y: textY,
      size: FONT_SIZE_TEXT,
      font: ctx.helvetica,
      color: COLOR_BLACK,
    });
    textY -= lineHeight;
  }

  textY -= lineHeight / 2; // Espaço entre parágrafos

  for (const line of lines2) {
    ctx.page.drawText(line, {
      x: MARGIN_LEFT + padding,
      y: textY,
      size: FONT_SIZE_TEXT,
      font: ctx.helvetica,
      color: COLOR_BLACK,
    });
    textY -= lineHeight;
  }

  // Linha de data
  textY -= lineHeight;
  ctx.page.drawText('__________________, ______ de __________________ de ________', {
    x: MARGIN_LEFT + padding,
    y: textY,
    size: FONT_SIZE_TEXT,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });

  // Linha de assinatura (à direita)
  textY -= lineHeight * 2;
  const assinaturaText = '___________________________________________';
  ctx.page.drawText(assinaturaText, {
    x: MARGIN_LEFT + CONTENT_WIDTH - padding - ctx.helvetica.widthOfTextAtSize(assinaturaText, FONT_SIZE_TEXT),
    y: textY,
    size: FONT_SIZE_TEXT,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });

  textY -= lineHeight;
  const assinaturaLabel = 'Assinatura do Declarante/Remetente';
  ctx.page.drawText(assinaturaLabel, {
    x: MARGIN_LEFT + CONTENT_WIDTH - padding - ctx.helvetica.widthOfTextAtSize(assinaturaLabel, FONT_SIZE_TEXT),
    y: textY,
    size: FONT_SIZE_SMALL,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });

  return y - textBlockHeight;
}

/**
 * Desenha bloco de atenção
 */
function drawAtencao(ctx: DrawContext, y: number): number {
  const rowHeight = 20;

  drawRect(ctx, MARGIN_LEFT, y - rowHeight, CONTENT_WIDTH, rowHeight);
  ctx.page.drawText('Atenção:', {
    x: MARGIN_LEFT + 4,
    y: y - rowHeight + 6,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText('O declarante/remetente é responsável exclusivamente pelas informações declaradas.', {
    x: MARGIN_LEFT + 50,
    y: y - rowHeight + 6,
    size: FONT_SIZE_TEXT,
    font: ctx.helvetica,
    color: COLOR_BLACK,
  });

  return y - rowHeight;
}

/**
 * Desenha bloco de observações
 */
function drawObservacoes(ctx: DrawContext, y: number): number {
  const headerHeight = 16;
  const padding = 8;
  const lineHeight = 9;

  // Header "OBSERVAÇÕES:"
  drawRect(ctx, MARGIN_LEFT, y - headerHeight, CONTENT_WIDTH, headerHeight);
  ctx.page.drawText('OBSERVAÇÕES:', {
    x: MARGIN_LEFT + 4,
    y: y - headerHeight + 4,
    size: FONT_SIZE_LABEL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });
  y -= headerHeight;

  // Calcular altura do texto
  const textWidth = CONTENT_WIDTH - 2 * padding - 20; // -20 para margem do número romano
  const lines1 = wrapText(TEXTO_OBS_1, ctx.helvetica, FONT_SIZE_SMALL, textWidth);
  const lines2 = wrapText(TEXTO_OBS_2, ctx.helvetica, FONT_SIZE_SMALL, textWidth);
  const totalLines = lines1.length + lines2.length + 2; // +2 para espaço entre itens
  const textBlockHeight = totalLines * lineHeight + 2 * padding;

  // Caixa de texto
  drawRect(ctx, MARGIN_LEFT, y - textBlockHeight, CONTENT_WIDTH, textBlockHeight);

  // Desenhar texto
  let textY = y - padding - lineHeight;

  // I.
  ctx.page.drawText('I.', {
    x: MARGIN_LEFT + padding,
    y: textY,
    size: FONT_SIZE_SMALL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });

  for (const line of lines1) {
    ctx.page.drawText(line, {
      x: MARGIN_LEFT + padding + 20,
      y: textY,
      size: FONT_SIZE_SMALL,
      font: ctx.helvetica,
      color: COLOR_BLACK,
    });
    textY -= lineHeight;
  }

  textY -= lineHeight / 2; // Espaço entre itens

  // II.
  ctx.page.drawText('II.', {
    x: MARGIN_LEFT + padding,
    y: textY,
    size: FONT_SIZE_SMALL,
    font: ctx.helveticaBold,
    color: COLOR_BLACK,
  });

  for (const line of lines2) {
    ctx.page.drawText(line, {
      x: MARGIN_LEFT + padding + 20,
      y: textY,
      size: FONT_SIZE_SMALL,
      font: ctx.helvetica,
      color: COLOR_BLACK,
    });
    textY -= lineHeight;
  }

  return y - textBlockHeight;
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE GERAÇÃO
// ============================================================================

/**
 * Gera o PDF da Declaração de Conteúdo
 */
export async function generateDeclaracaoConteudoPdf(
  payload: DeclaracaoConteudoPayload
): Promise<Uint8Array> {
  const { remetente, destinatario, itens, pesoTotalKg } = payload;

  // Criar documento PDF
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Criar página
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Contexto de desenho
  const ctx: DrawContext = {
    page,
    helvetica,
    helveticaBold,
    yPosition: PAGE_HEIGHT - MARGIN_TOP,
  };

  // Desenhar seções
  let y = drawHeader(ctx, null);

  y -= 10; // Espaço após header
  y = drawPessoaBlock(ctx, y, 'REMETENTE', remetente);

  y -= 10; // Espaço entre blocos
  y = drawPessoaBlock(ctx, y, 'DESTINATÁRIO', destinatario);

  y -= 15; // Espaço antes da tabela
  y = drawTabelaBens(ctx, y, itens, pesoTotalKg);

  y -= 15; // Espaço antes da declaração
  y = drawDeclaracao(ctx, y);

  y -= 10; // Espaço antes da atenção
  y = drawAtencao(ctx, y);

  y -= 10; // Espaço antes das observações
  drawObservacoes(ctx, y);

  // Salvar PDF
  return pdfDoc.save();
}
