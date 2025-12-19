import 'client-only';

/**
 * Gerador de PDF para Declaração de Conteúdo e Espelho de NF-e
 * Usado na página de rastreamento público
 */

import { jsPDF } from 'jspdf';

export interface DocumentItem {
  description: string;
  quantity: number;
  unitValue?: number;
  subtotal?: number;
}

// Tipos para dados completos da NF-e
export interface NFeEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface NFeIdentificacao {
  modelo?: string | null;
  serie?: string | null;
  numero?: string | null;
  dataEmissao?: string | null;
  naturezaOp?: string | null;
  tipoOperacao?: string | null;
  ambiente?: string | null;
}

export interface NFeEmitente {
  cnpjCpf?: string | null;
  ie?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  endereco?: NFeEndereco | null;
}

export interface NFeDestinatario {
  cnpjCpf?: string | null;
  ie?: string | null;
  nome?: string | null;
  endereco?: NFeEndereco | null;
}

export interface NFeTotais {
  baseCalculoIcms?: number | null;
  valorIcms?: number | null;
  valorProdutos?: number | null;
  valorFrete?: number | null;
  valorSeguro?: number | null;
  valorDesconto?: number | null;
  valorOutros?: number | null;
  valorIpi?: number | null;
  valorPis?: number | null;
  valorCofins?: number | null;
  valorTotal?: number | null;
}

export interface NFePagamento {
  forma?: string | null;
  formaDescricao?: string | null;
  valor?: number | null;
}

export interface NFeProtocolo {
  numero?: string | null;
  dataAutorizacao?: string | null;
  status?: string | null;
  motivo?: string | null;
}

export interface NFeItemCompleto {
  id: string;
  sku?: string | null;
  descricao: string;
  ncm?: string | null;
  cfop?: string | null;
  unidade?: string | null;
  quantidade: number;
  pesoLiquido?: number | null;
  valorUnitario: number;
  valorTotal: number;
}

export interface NFeData {
  chave: string;
  numero: string;
  serie: string;
  valorTotal: number;
  items: NFeItemCompleto[];
  identificacao?: NFeIdentificacao | null;
  emitente?: NFeEmitente | null;
  destinatario?: NFeDestinatario | null;
  totais?: NFeTotais | null;
  pagamentos?: NFePagamento[] | null;
  protocolo?: NFeProtocolo | null;
}

export interface VolumeData {
  index: number;
  documentType: 'DECLARATION' | 'NF';
  nfKey?: string;
  height?: number;
  width?: number;
  length?: number;
  weight?: number;
  items: DocumentItem[];
  // Dados completos da NF-e para espelho
  nfeData?: NFeData | null;
}

export interface ShipmentInfo {
  trackingCode: string;
  carrier: string;
  service: string;
  origin: {
    cep: string;
  };
  destination: {
    cep: string;
    city: string;
    state: string;
  };
  createdAt: string;
}

// Formatador de moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Formatar chave NF-e com pontos para legibilidade
const formatNFeKey = (key: string): string => {
  // Formato: 0000.0000.0000.0000.0000.0000.0000.0000.0000.0000.0000
  return key.replace(/(\d{4})/g, '$1.').slice(0, -1);
};

/**
 * Gera PDF de Declaração de Conteúdo
 */
export function generateDeclarationPDF(
  volume: VolumeData,
  shipmentInfo: ShipmentInfo
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO DE CONTEÚDO', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('(Para remessa sem valor comercial)', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Informações do envio
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES DO ENVIO', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Código de Rastreamento: ${shipmentInfo.trackingCode}`, margin, y);
  y += 5;
  doc.text(`Transportadora: ${shipmentInfo.carrier} - ${shipmentInfo.service}`, margin, y);
  y += 5;
  doc.text(`Volume: ${volume.index}`, margin, y);
  y += 5;
  doc.text(`Data: ${new Date(shipmentInfo.createdAt).toLocaleDateString('pt-BR')}`, margin, y);
  y += 10;

  // Origem e Destino
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGEM / DESTINO', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Origem: CEP ${shipmentInfo.origin.cep}`, margin, y);
  y += 5;
  doc.text(
    `Destino: ${shipmentInfo.destination.city}/${shipmentInfo.destination.state} - CEP ${shipmentInfo.destination.cep}`,
    margin,
    y
  );
  y += 10;

  // Dimensões do volume (se disponíveis)
  if (volume.height || volume.width || volume.length || volume.weight) {
    doc.setFont('helvetica', 'bold');
    doc.text('DIMENSÕES DO VOLUME', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    const dims = [];
    if (volume.height && volume.width && volume.length) {
      dims.push(`Dimensões: ${volume.height} x ${volume.width} x ${volume.length} cm`);
    }
    if (volume.weight) {
      dims.push(`Peso: ${volume.weight} kg`);
    }
    doc.text(dims.join('  |  '), margin, y);
    y += 10;
  }

  // Tabela de itens
  doc.setFont('helvetica', 'bold');
  doc.text('CONTEÚDO DECLARADO', margin, y);
  y += 6;

  // Cabeçalho da tabela
  const colWidths = {
    num: 10,
    desc: contentWidth - 60,
    qty: 15,
    unit: 20,
    total: 25,
  };

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 1, contentWidth, 7, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let x = margin + 2;
  doc.text('#', x, y + 4);
  x += colWidths.num;
  doc.text('Descrição', x, y + 4);
  x += colWidths.desc;
  doc.text('Qtd', x, y + 4);
  x += colWidths.qty;
  doc.text('Valor Unit.', x, y + 4);
  x += colWidths.unit;
  doc.text('Subtotal', x, y + 4);
  y += 8;

  // Linhas da tabela
  doc.setFont('helvetica', 'normal');
  let totalValue = 0;

  if (volume.items.length === 0) {
    doc.text('Nenhum item declarado', margin + 2, y + 4);
    y += 8;
  } else {
    volume.items.forEach((item, idx) => {
      const subtotal = item.subtotal ?? (item.unitValue ?? 0) * item.quantity;
      totalValue += subtotal;

      x = margin + 2;
      doc.text(String(idx + 1), x, y + 4);
      x += colWidths.num;

      // Truncar descrição se necessário
      const maxDescWidth = colWidths.desc - 5;
      let desc = item.description;
      while (doc.getTextWidth(desc) > maxDescWidth && desc.length > 10) {
        desc = desc.slice(0, -4) + '...';
      }
      doc.text(desc, x, y + 4);
      x += colWidths.desc;

      doc.text(String(item.quantity), x, y + 4);
      x += colWidths.qty;

      doc.text(item.unitValue ? formatCurrency(item.unitValue) : '-', x, y + 4);
      x += colWidths.unit;

      doc.text(formatCurrency(subtotal), x, y + 4);
      y += 6;

      // Verificar se precisa nova página
      if (y > 260) {
        doc.addPage();
        y = margin;
      }
    });
  }

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DECLARADO:', margin, y + 4);
  doc.text(formatCurrency(totalValue), margin + contentWidth - 25, y + 4);
  y += 15;

  // Aviso legal
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const disclaimer = [
    'DECLARO que não me é possível fazer a postagem com envio registrado por conter itens sem valor comercial.',
    'Declaro ainda que assumo inteira responsabilidade pelo conteúdo declarado e que não estou enviando',
    'mercadoria sujeita a tributação ou proibida por lei.',
  ];
  disclaimer.forEach((line) => {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 4;
  });

  y += 15;

  // Assinaturas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const sigY = y;
  const sigWidth = (contentWidth - 20) / 2;

  // Remetente
  doc.line(margin, sigY, margin + sigWidth, sigY);
  doc.text('Assinatura do Remetente', margin + sigWidth / 2, sigY + 5, { align: 'center' });

  // Destinatário
  doc.line(margin + sigWidth + 20, sigY, margin + contentWidth, sigY);
  doc.text('Assinatura do Destinatário', margin + sigWidth + 20 + sigWidth / 2, sigY + 5, {
    align: 'center',
  });

  // Rodapé
  y = 280;
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')} - EnvioLegal`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  return doc;
}

// Formatar CNPJ
const formatCnpjCpf = (value: string | null | undefined): string => {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 14) {
    // CNPJ
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  } else if (digits.length === 11) {
    // CPF
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return value;
};

// Formatar data ISO para pt-BR
const formatDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '-';
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoDate;
  }
};

// Formatar endereço em uma linha
const formatAddress = (endereco: NFeEndereco | null | undefined): string => {
  if (!endereco) return '-';
  const parts = [
    endereco.logradouro,
    endereco.numero,
    endereco.complemento,
    endereco.bairro,
    endereco.cidade,
    endereco.uf,
    endereco.cep ? `CEP: ${endereco.cep}` : null,
  ].filter(Boolean);
  return parts.join(', ') || '-';
};

/**
 * Gera PDF de Espelho de NF-e (estilo DANFE simplificado)
 * Se nfeData estiver disponível, usa os dados completos.
 * Caso contrário, usa os items básicos.
 */
export function generateNFePDF(volume: VolumeData, _shipmentInfo: ShipmentInfo): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const nfe = volume.nfeData;

  // ========== CABEÇALHO ==========
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 12, 'F');
  doc.setDrawColor(0);
  doc.rect(margin, y, contentWidth, 12);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ESPELHO DA NF-e', pageWidth / 2, y + 8, { align: 'center' });
  y += 14;

  // ========== CHAVE DE ACESSO ==========
  const chave = volume.nfKey || nfe?.chave;
  if (chave) {
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y, contentWidth, 12, 'F');
    doc.rect(margin, y, contentWidth, 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CHAVE DE ACESSO', margin + 2, y + 4);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(formatNFeKey(chave), margin + 2, y + 9);
    y += 14;
  }

  // ========== IDENTIFICAÇÃO DA NF-e ==========
  const ident = nfe?.identificacao;
  if (ident) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.rect(margin, y, contentWidth, 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('IDENTIFICAÇÃO DA NF-e', margin + 2, y + 4);
    y += 8;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const identInfo = [
      `Modelo: ${ident.modelo || '-'}`,
      `Série: ${ident.serie || nfe?.serie || '-'}`,
      `Número: ${ident.numero || nfe?.numero || '-'}`,
      `Emissão: ${formatDate(ident.dataEmissao)}`,
    ];
    doc.text(identInfo.join('   |   '), margin + 2, y + 3);
    y += 5;

    if (ident.naturezaOp) {
      doc.text(`Natureza da Operação: ${ident.naturezaOp}`, margin + 2, y + 3);
      y += 5;
    }
    y += 3;
  }

  // ========== EMITENTE ==========
  const emit = nfe?.emitente;
  if (emit) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.rect(margin, y, contentWidth, 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('EMITENTE', margin + 2, y + 4);
    y += 8;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Razão Social: ${emit.razaoSocial || '-'}`, margin + 2, y + 3);
    y += 4;
    if (emit.nomeFantasia) {
      doc.text(`Nome Fantasia: ${emit.nomeFantasia}`, margin + 2, y + 3);
      y += 4;
    }
    doc.text(`CNPJ/CPF: ${formatCnpjCpf(emit.cnpjCpf)}   |   IE: ${emit.ie || '-'}`, margin + 2, y + 3);
    y += 4;
    doc.text(`Endereço: ${formatAddress(emit.endereco)}`, margin + 2, y + 3);
    y += 6;
  }

  // ========== DESTINATÁRIO ==========
  const dest = nfe?.destinatario;
  if (dest) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.rect(margin, y, contentWidth, 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATÁRIO', margin + 2, y + 4);
    y += 8;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome/Razão Social: ${dest.nome || '-'}`, margin + 2, y + 3);
    y += 4;
    doc.text(`CNPJ/CPF: ${formatCnpjCpf(dest.cnpjCpf)}   |   IE: ${dest.ie || '-'}`, margin + 2, y + 3);
    y += 4;
    doc.text(`Endereço: ${formatAddress(dest.endereco)}`, margin + 2, y + 3);
    y += 6;
  }

  // ========== ITENS DA NF-e ==========
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.rect(margin, y, contentWidth, 6);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS DA NOTA FISCAL', margin + 2, y + 4);
  y += 8;

  // Cabeçalho da tabela
  const colWidths = { num: 8, cod: 18, desc: 60, ncm: 20, un: 10, qty: 12, unit: 22, total: 25 };
  const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
  const tableMargin = margin + (contentWidth - tableWidth) / 2;

  doc.setFillColor(230, 230, 230);
  doc.rect(tableMargin, y, tableWidth, 6, 'F');
  doc.rect(tableMargin, y, tableWidth, 6);

  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  let x = tableMargin + 1;
  doc.text('#', x, y + 4); x += colWidths.num;
  doc.text('Código', x, y + 4); x += colWidths.cod;
  doc.text('Descrição', x, y + 4); x += colWidths.desc;
  doc.text('NCM', x, y + 4); x += colWidths.ncm;
  doc.text('Un', x, y + 4); x += colWidths.un;
  doc.text('Qtd', x, y + 4); x += colWidths.qty;
  doc.text('Valor Unit.', x, y + 4); x += colWidths.unit;
  doc.text('Total', x, y + 4);
  y += 7;

  // Linhas da tabela
  doc.setFont('helvetica', 'normal');
  const items = nfe?.items || volume.items.map((item, idx) => ({
    id: String(idx + 1),
    sku: null,
    descricao: item.description,
    ncm: null,
    cfop: null,
    unidade: null,
    quantidade: item.quantity,
    pesoLiquido: null,
    valorUnitario: item.unitValue || 0,
    valorTotal: item.subtotal || (item.unitValue || 0) * item.quantity,
  }));

  let totalValue = 0;
  items.forEach((item, idx) => {
    totalValue += item.valorTotal || 0;

    // Verificar se precisa nova página
    if (y > 260) {
      doc.addPage();
      y = margin;
    }

    x = tableMargin + 1;
    doc.text(String(idx + 1), x, y + 3); x += colWidths.num;
    doc.text((item.sku || '-').substring(0, 10), x, y + 3); x += colWidths.cod;

    // Truncar descrição
    let desc = item.descricao || '-';
    const maxDescWidth = colWidths.desc - 2;
    while (doc.getTextWidth(desc) > maxDescWidth && desc.length > 10) {
      desc = desc.slice(0, -4) + '...';
    }
    doc.text(desc, x, y + 3); x += colWidths.desc;

    doc.text((item.ncm || '-').substring(0, 8), x, y + 3); x += colWidths.ncm;
    doc.text((item.unidade || '-').substring(0, 4), x, y + 3); x += colWidths.un;
    doc.text(String(item.quantidade), x, y + 3); x += colWidths.qty;
    doc.text(formatCurrency(item.valorUnitario).replace('R$', '').trim(), x, y + 3); x += colWidths.unit;
    doc.text(formatCurrency(item.valorTotal).replace('R$', '').trim(), x, y + 3);
    y += 5;
  });

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(tableMargin, y, tableMargin + tableWidth, y);
  y += 3;

  // ========== TOTAIS ==========
  const totais = nfe?.totais;
  if (totais) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.rect(margin, y, contentWidth, 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAIS', margin + 2, y + 4);
    y += 8;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    // Linha 1: BC ICMS, ICMS, Produtos
    const linha1 = [
      `BC ICMS: ${formatCurrency(totais.baseCalculoIcms || 0)}`,
      `ICMS: ${formatCurrency(totais.valorIcms || 0)}`,
      `Produtos: ${formatCurrency(totais.valorProdutos || 0)}`,
    ];
    doc.text(linha1.join('   |   '), margin + 2, y + 3);
    y += 4;

    // Linha 2: Frete, Seguro, Desconto
    const linha2 = [
      `Frete: ${formatCurrency(totais.valorFrete || 0)}`,
      `Seguro: ${formatCurrency(totais.valorSeguro || 0)}`,
      `Desconto: ${formatCurrency(totais.valorDesconto || 0)}`,
    ];
    doc.text(linha2.join('   |   '), margin + 2, y + 3);
    y += 4;

    // Linha 3: IPI, PIS, COFINS
    if (totais.valorIpi || totais.valorPis || totais.valorCofins) {
      const linha3 = [
        `IPI: ${formatCurrency(totais.valorIpi || 0)}`,
        `PIS: ${formatCurrency(totais.valorPis || 0)}`,
        `COFINS: ${formatCurrency(totais.valorCofins || 0)}`,
      ];
      doc.text(linha3.join('   |   '), margin + 2, y + 3);
      y += 4;
    }

    // Total geral
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`VALOR TOTAL DA NF-e: ${formatCurrency(totais.valorTotal || nfe?.valorTotal || totalValue)}`, margin + 2, y + 4);
    y += 8;
  } else {
    // Fallback: mostrar apenas total calculado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`VALOR TOTAL: ${formatCurrency(nfe?.valorTotal || totalValue)}`, margin + 2, y + 4);
    y += 8;
  }

  // ========== PROTOCOLO DE AUTORIZAÇÃO ==========
  const protocolo = nfe?.protocolo;
  if (protocolo) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.rect(margin, y, contentWidth, 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOLO DE AUTORIZAÇÃO', margin + 2, y + 4);
    y += 8;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Número: ${protocolo.numero || '-'}   |   Data: ${formatDate(protocolo.dataAutorizacao)}`, margin + 2, y + 3);
    y += 4;
    if (protocolo.motivo) {
      doc.text(`Status: ${protocolo.status || '-'} - ${protocolo.motivo}`, margin + 2, y + 3);
      y += 4;
    }
    y += 2;
  }

  // ========== AVISO ==========
  y = Math.max(y + 5, 265);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Este documento é apenas um espelho informativo da NF-e. O DANFE oficial pode ser consultado no portal da SEFAZ.', pageWidth / 2, y, { align: 'center' });

  // ========== RODAPÉ ==========
  y = 285;
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} - EnvioLegal`, pageWidth / 2, y, { align: 'center' });

  return doc;
}

/**
 * Gera e abre o PDF em nova aba para visualização/download/impressão
 */
export function openDocumentPDF(volume: VolumeData, shipmentInfo: ShipmentInfo): void {
  const doc =
    volume.documentType === 'NF'
      ? generateNFePDF(volume, shipmentInfo)
      : generateDeclarationPDF(volume, shipmentInfo);

  // Gerar blob e abrir em nova aba
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

/**
 * Gera e faz download do PDF
 */
export function downloadDocumentPDF(volume: VolumeData, shipmentInfo: ShipmentInfo): void {
  const doc =
    volume.documentType === 'NF'
      ? generateNFePDF(volume, shipmentInfo)
      : generateDeclarationPDF(volume, shipmentInfo);

  const filename =
    volume.documentType === 'NF'
      ? `espelho-nfe-${shipmentInfo.trackingCode}-vol${volume.index}.pdf`
      : `declaracao-${shipmentInfo.trackingCode}-vol${volume.index}.pdf`;

  doc.save(filename);
}
