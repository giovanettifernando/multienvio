import { NextResponse } from 'next/server';
import type { InvoiceData, InvoiceItem, ParseXmlResponse } from '@/lib/types/invoice';

export const dynamic = 'force-dynamic';

// SECURITY: Limite de tamanho para prevenir ataques de DoS (XML bomb, Billion Laughs)
const MAX_XML_SIZE = 2 * 1024 * 1024; // 2 MB máximo para XML de NF-e

/**
 * Extrai o conteúdo de uma tag XML
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
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
 * POST /api/nfe/parse
 * Faz o parse de um XML da NF-e e retorna os itens estruturados
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { xml } = body;

    if (!xml || typeof xml !== 'string') {
      return NextResponse.json<ParseXmlResponse>(
        {
          success: false,
          error: 'XML não fornecido ou inválido',
        },
        { status: 400 }
      );
    }

    // SECURITY: Validar tamanho do XML para prevenir DoS
    if (xml.length > MAX_XML_SIZE) {
      return NextResponse.json<ParseXmlResponse>(
        {
          success: false,
          error: `XML muito grande. Tamanho máximo permitido: ${MAX_XML_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // SECURITY: Detectar possíveis ataques de XML entity expansion
    if (xml.includes('<!ENTITY') || xml.includes('<!DOCTYPE')) {
      console.warn('[NFE_PARSE] Potencial ataque de XML entity expansion detectado');
      return NextResponse.json<ParseXmlResponse>(
        {
          success: false,
          error: 'XML inválido: DOCTYPE e ENTITY não são permitidos',
        },
        { status: 400 }
      );
    }

    // Extrair chave da NF-e do atributo Id
    const idMatch = xml.match(/<infNFe[^>]+Id="NFe(\d{44})"/i) || xml.match(/<infNFe[^>]+id="NFe(\d{44})"/i);
    const chave = idMatch ? idMatch[1] : null;

    if (!chave || chave.length !== 44) {
      // Tentar extrair da tag chNFe como fallback
      const chNFeMatch = xml.match(/<chNFe>(\d{44})<\/chNFe>/i);
      const chaveAlt = chNFeMatch ? chNFeMatch[1] : null;

      if (!chaveAlt || chaveAlt.length !== 44) {
        return NextResponse.json<ParseXmlResponse>(
          {
            success: false,
            error: 'Não foi possível extrair a chave da NF-e',
          },
          { status: 400 }
        );
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
      const qComStr = extractTag(detXml, 'qCom');
      const vUnComStr = extractTag(detXml, 'vUnCom');
      const vProdStr = extractTag(detXml, 'vProd');
      const pesoLStr = extractTag(detXml, 'pesoL');

      const qCom = qComStr ? parseFloat(qComStr) : 0;
      const vUnCom = vUnComStr ? parseFloat(vUnComStr) : 0;
      const vProd = vProdStr ? parseFloat(vProdStr) : 0;
      const pesoLiquido = pesoLStr ? parseFloat(pesoLStr) : null;

      items.push({
        id: `${finalChave}-${index + 1}`,
        sku: cProd || null,
        descricao: xProd,
        ncm: ncm,
        cfop: cfop,
        quantidade: qCom,
        pesoLiquido: pesoLiquido,
        valorUnitario: vUnCom,
        valorTotal: vProd,
      });
    });

    if (items.length === 0) {
      return NextResponse.json<ParseXmlResponse>(
        {
          success: false,
          error: 'Nenhum item encontrado no XML da NF-e',
        },
        { status: 400 }
      );
    }

    const invoiceData: InvoiceData = {
      chave: finalChave,
      numero,
      serie,
      valorTotal,
      items,
    };

    return NextResponse.json<ParseXmlResponse>(
      {
        success: true,
        data: invoiceData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[NFE_PARSE]', error);
    return NextResponse.json<ParseXmlResponse>(
      {
        success: false,
        error: 'Erro ao processar XML da NF-e',
      },
      { status: 500 }
    );
  }
}
