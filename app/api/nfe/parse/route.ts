import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import type {
  InvoiceData,
  InvoiceItem,
  ParseXmlResponse,
  NFeIdentificacao,
  NFeEmitente,
  NFeDestinatario,
  NFeEndereco,
  NFeTotais,
  NFePagamento,
  NFeProtocolo,
  NFeImpostosItem,
} from '@/lib/types/invoice';


// SECURITY: Limite de tamanho para prevenir ataques de DoS (XML bomb, Billion Laughs)
const MAX_XML_SIZE = 2 * 1024 * 1024; // 2 MB máximo para XML de NF-e

// Mapeamento de formas de pagamento
const FORMAS_PAGAMENTO: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'PIX',
  '18': 'Transferência bancária',
  '19': 'Cashback',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

/**
 * Decodifica entidades XML (ex: &amp; -> &, &lt; -> <)
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extrai o conteúdo de uma tag XML
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

/**
 * Extrai o primeiro bloco de uma tag (incluindo tags internas)
 */
function extractBlock(xml: string, tag: string): string | null {
  const blocks = extractBlocks(xml, tag);
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * Extrai blocos completos de uma tag (incluindo tags internas)
 */
function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
  const closeTag = new RegExp(`<\/${tag}>`, 'i');

  let match;

  while ((match = regex.exec(xml)) !== null) {
    const startPos = match.index;
    const searchFrom = startPos + match[0].length;
    const closeMatch = xml.substring(searchFrom).match(closeTag);

    if (closeMatch && closeMatch.index !== undefined) {
      const endPos = searchFrom + closeMatch.index + closeMatch[0].length;
      blocks.push(xml.substring(startPos, endPos));
    }
  }

  return blocks;
}

/**
 * Parse float seguro - retorna null se não for um número válido
 */
function safeParseFloat(value: string | null): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Extrai identificação da NF-e
 */
function extractIdentificacao(xml: string): NFeIdentificacao | null {
  const ideBlock = extractBlock(xml, 'ide');
  if (!ideBlock) return null;

  return {
    modelo: extractTag(ideBlock, 'mod'),
    serie: extractTag(ideBlock, 'serie'),
    numero: extractTag(ideBlock, 'nNF'),
    dataEmissao: extractTag(ideBlock, 'dhEmi'),
    naturezaOp: extractTag(ideBlock, 'natOp'),
    tipoOperacao: extractTag(ideBlock, 'tpNF'),
    ambiente: extractTag(ideBlock, 'tpAmb'),
  };
}

/**
 * Extrai endereço de um bloco XML
 */
function extractEndereco(xml: string, tagEndereco: string): NFeEndereco | null {
  const enderBlock = extractBlock(xml, tagEndereco);
  if (!enderBlock) return null;

  return {
    logradouro: extractTag(enderBlock, 'xLgr'),
    numero: extractTag(enderBlock, 'nro'),
    complemento: extractTag(enderBlock, 'xCpl'),
    bairro: extractTag(enderBlock, 'xBairro'),
    cidade: extractTag(enderBlock, 'xMun'),
    uf: extractTag(enderBlock, 'UF'),
    cep: extractTag(enderBlock, 'CEP'),
    pais: extractTag(enderBlock, 'xPais'),
    telefone: extractTag(enderBlock, 'fone'),
  };
}

/**
 * Extrai emitente da NF-e
 */
function extractEmitente(xml: string): NFeEmitente | null {
  const emitBlock = extractBlock(xml, 'emit');
  if (!emitBlock) return null;

  return {
    cnpjCpf: extractTag(emitBlock, 'CNPJ') || extractTag(emitBlock, 'CPF'),
    ie: extractTag(emitBlock, 'IE'),
    razaoSocial: extractTag(emitBlock, 'xNome'),
    nomeFantasia: extractTag(emitBlock, 'xFant'),
    endereco: extractEndereco(emitBlock, 'enderEmit'),
  };
}

/**
 * Extrai destinatário da NF-e
 */
function extractDestinatario(xml: string): NFeDestinatario | null {
  const destBlock = extractBlock(xml, 'dest');
  if (!destBlock) return null;

  return {
    cnpjCpf: extractTag(destBlock, 'CNPJ') || extractTag(destBlock, 'CPF'),
    ie: extractTag(destBlock, 'IE'),
    nome: extractTag(destBlock, 'xNome'),
    endereco: extractEndereco(destBlock, 'enderDest'),
  };
}

/**
 * Extrai totais da NF-e
 */
function extractTotais(xml: string): NFeTotais | null {
  const totalBlock = extractBlock(xml, 'total');
  if (!totalBlock) return null;

  const icmsTotBlock = extractBlock(totalBlock, 'ICMSTot');
  if (!icmsTotBlock) return null;

  return {
    baseCalculoIcms: safeParseFloat(extractTag(icmsTotBlock, 'vBC')),
    valorIcms: safeParseFloat(extractTag(icmsTotBlock, 'vICMS')),
    valorProdutos: safeParseFloat(extractTag(icmsTotBlock, 'vProd')),
    valorFrete: safeParseFloat(extractTag(icmsTotBlock, 'vFrete')),
    valorSeguro: safeParseFloat(extractTag(icmsTotBlock, 'vSeg')),
    valorDesconto: safeParseFloat(extractTag(icmsTotBlock, 'vDesc')),
    valorOutros: safeParseFloat(extractTag(icmsTotBlock, 'vOutro')),
    valorIpi: safeParseFloat(extractTag(icmsTotBlock, 'vIPI')),
    valorPis: safeParseFloat(extractTag(icmsTotBlock, 'vPIS')),
    valorCofins: safeParseFloat(extractTag(icmsTotBlock, 'vCOFINS')),
    valorTotal: safeParseFloat(extractTag(icmsTotBlock, 'vNF')),
  };
}

/**
 * Extrai pagamentos da NF-e
 */
function extractPagamentos(xml: string): NFePagamento[] | null {
  const pagBlock = extractBlock(xml, 'pag');
  if (!pagBlock) return null;

  const detPagBlocks = extractBlocks(pagBlock, 'detPag');
  if (detPagBlocks.length === 0) return null;

  return detPagBlocks.map((detPag) => {
    const forma = extractTag(detPag, 'tPag');
    return {
      forma,
      formaDescricao: forma ? FORMAS_PAGAMENTO[forma] || 'Desconhecido' : null,
      valor: safeParseFloat(extractTag(detPag, 'vPag')),
    };
  });
}

/**
 * Extrai protocolo de autorização da NF-e
 */
function extractProtocolo(xml: string): NFeProtocolo | null {
  const protBlock = extractBlock(xml, 'protNFe');
  if (!protBlock) return null;

  const infProtBlock = extractBlock(protBlock, 'infProt');
  if (!infProtBlock) return null;

  return {
    numero: extractTag(infProtBlock, 'nProt'),
    dataAutorizacao: extractTag(infProtBlock, 'dhRecbto'),
    status: extractTag(infProtBlock, 'cStat'),
    motivo: extractTag(infProtBlock, 'xMotivo'),
  };
}

/**
 * Extrai impostos de um item
 */
function extractImpostosItem(detXml: string): NFeImpostosItem | null {
  const impostoBlock = extractBlock(detXml, 'imposto');
  if (!impostoBlock) return null;

  const result: NFeImpostosItem = {};

  // ICMS
  const icmsBlock = extractBlock(impostoBlock, 'ICMS');
  if (icmsBlock) {
    // Pode ser ICMS00, ICMS10, ICMS20, etc.
    const icmsInnerBlocks = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90', 'ICMSSN101', 'ICMSSN102', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500', 'ICMSSN900'];
    for (const tag of icmsInnerBlocks) {
      const inner = extractBlock(icmsBlock, tag);
      if (inner) {
        result.icms = {
          cst: extractTag(inner, 'CST') || extractTag(inner, 'CSOSN'),
          baseCalculo: safeParseFloat(extractTag(inner, 'vBC')),
          aliquota: safeParseFloat(extractTag(inner, 'pICMS')),
          valor: safeParseFloat(extractTag(inner, 'vICMS')),
        };
        break;
      }
    }
  }

  // IPI
  const ipiBlock = extractBlock(impostoBlock, 'IPI');
  if (ipiBlock) {
    const ipiTribBlock = extractBlock(ipiBlock, 'IPITrib');
    if (ipiTribBlock) {
      result.ipi = {
        cst: extractTag(ipiTribBlock, 'CST'),
        baseCalculo: safeParseFloat(extractTag(ipiTribBlock, 'vBC')),
        aliquota: safeParseFloat(extractTag(ipiTribBlock, 'pIPI')),
        valor: safeParseFloat(extractTag(ipiTribBlock, 'vIPI')),
      };
    }
  }

  // PIS
  const pisBlock = extractBlock(impostoBlock, 'PIS');
  if (pisBlock) {
    const pisAliqBlock = extractBlock(pisBlock, 'PISAliq') || extractBlock(pisBlock, 'PISOutr');
    if (pisAliqBlock) {
      result.pis = {
        cst: extractTag(pisAliqBlock, 'CST'),
        baseCalculo: safeParseFloat(extractTag(pisAliqBlock, 'vBC')),
        aliquota: safeParseFloat(extractTag(pisAliqBlock, 'pPIS')),
        valor: safeParseFloat(extractTag(pisAliqBlock, 'vPIS')),
      };
    }
  }

  // COFINS
  const cofinsBlock = extractBlock(impostoBlock, 'COFINS');
  if (cofinsBlock) {
    const cofinsAliqBlock = extractBlock(cofinsBlock, 'COFINSAliq') || extractBlock(cofinsBlock, 'COFINSOutr');
    if (cofinsAliqBlock) {
      result.cofins = {
        cst: extractTag(cofinsAliqBlock, 'CST'),
        baseCalculo: safeParseFloat(extractTag(cofinsAliqBlock, 'vBC')),
        aliquota: safeParseFloat(extractTag(cofinsAliqBlock, 'pCOFINS')),
        valor: safeParseFloat(extractTag(cofinsAliqBlock, 'vCOFINS')),
      };
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// Tipo para resposta POST /api/nfe/parse
type ParseNfeResponse = {
  success: boolean;
  data: InvoiceData;
};

const NFeParseSchema = z.object({
  xml: z.string().min(1),
});

/**
 * POST /api/nfe/parse
 * Faz o parse de um XML da NF-e e retorna os itens estruturados
 */
export const POST = withApiHandler<ParseNfeResponse>(async (context) => {
  const body = await context.req.json();

  const parsed = NFeParseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { xml } = parsed.data;

  // SECURITY: Validar tamanho do XML para prevenir DoS
  if (xml.length > MAX_XML_SIZE) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: `XML muito grande. Tamanho máximo permitido: ${MAX_XML_SIZE / 1024 / 1024}MB`,
      status: 400
    });
  }

  // SECURITY: Detectar possíveis ataques de XML entity expansion
  if (xml.includes('<!ENTITY') || xml.includes('<!DOCTYPE')) {
    context.logger.warn('nfe.parse.security_warning', { message: 'Potencial ataque de XML entity expansion detectado' });
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'XML inválido: DOCTYPE e ENTITY não são permitidos',
      status: 400
    });
  }

  // Extrair chave da NF-e do atributo Id
  const idMatch = xml.match(/<infNFe[^>]+Id="NFe(\d{44})"/i) || xml.match(/<infNFe[^>]+id="NFe(\d{44})"/i);
  const chave = idMatch ? idMatch[1] : null;

  if (!chave || chave.length !== 44) {
    // Tentar extrair da tag chNFe como fallback
    const chNFeMatch = xml.match(/<chNFe>(\d{44})<\/chNFe>/i);
    const chaveAlt = chNFeMatch ? chNFeMatch[1] : null;

    if (!chaveAlt || chaveAlt.length !== 44) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Não foi possível extrair a chave da NF-e',
        status: 400
      });
    }
  }

  const finalChave = chave || '';

  // Extrair número e série
  const numero = extractTag(xml, 'nNF') || '';
  const serie = extractTag(xml, 'serie') || '';

  // Extrair valor total
  const valorTotalStr = extractTag(xml, 'vNF');
  const valorTotal = valorTotalStr ? parseFloat(valorTotalStr) : 0;

  // Extrair blocos <det>
  const detBlocks = extractBlocks(xml, 'det');
  const items: InvoiceItem[] = [];

  detBlocks.forEach((detXml, index) => {
    const cProd = extractTag(detXml, 'cProd') || '';
    const xProd = extractTag(detXml, 'xProd') || '';
    const ncm = extractTag(detXml, 'NCM');
    const cfop = extractTag(detXml, 'CFOP');
    const uCom = extractTag(detXml, 'uCom');
    const qComStr = extractTag(detXml, 'qCom');
    const vUnComStr = extractTag(detXml, 'vUnCom');
    const vProdStr = extractTag(detXml, 'vProd');
    const pesoLStr = extractTag(detXml, 'pesoL');

    const qCom = qComStr ? parseFloat(qComStr) : 0;
    const vUnCom = vUnComStr ? parseFloat(vUnComStr) : 0;
    const vProd = vProdStr ? parseFloat(vProdStr) : 0;
    const pesoLiquido = pesoLStr ? parseFloat(pesoLStr) : null;

    // Extrair impostos do item (opcional, não blocante)
    const impostos = extractImpostosItem(detXml);

    items.push({
      id: `${finalChave}-${index + 1}`,
      sku: cProd || null,
      descricao: xProd,
      ncm: ncm,
      cfop: cfop,
      unidade: uCom,
      quantidade: qCom,
      pesoLiquido: pesoLiquido,
      valorUnitario: vUnCom,
      valorTotal: vProd,
      impostos: impostos,
    });
  });

  if (items.length === 0) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Nenhum item encontrado no XML da NF-e',
      status: 400
    });
  }

  // Extrair dados adicionais para espelho NF-e (todos opcionais, não blocantes)
  const identificacao = extractIdentificacao(xml);
  const emitente = extractEmitente(xml);
  const destinatario = extractDestinatario(xml);
  const totais = extractTotais(xml);
  const pagamentos = extractPagamentos(xml);
  const protocolo = extractProtocolo(xml);

  const invoiceData: InvoiceData = {
    chave: finalChave,
    numero,
    serie,
    valorTotal,
    items,
    // Dados adicionais para espelho NF-e
    identificacao,
    emitente,
    destinatario,
    totais,
    pagamentos,
    protocolo,
  };

  return {
    data: {
      success: true,
      data: invoiceData,
    }
  };
});
