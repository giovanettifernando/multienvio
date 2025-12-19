import 'client-only';

/**
 * Gerador de códigos de barras para etiquetas Correios
 * Usa bwip-js para gerar Data Matrix, Code 128 e GS1-128
 * Compatível com browser (usa canvas)
 */

import bwipjs, { type BwipOptions } from "bwip-js";

export interface BarcodeOptions {
  /** Escala do código de barras (padrão: 2) */
  scale?: number;
  /** Cor do módulo (padrão: preto) */
  barcolor?: string;
  /** Cor do fundo (padrão: branco) */
  backgroundcolor?: string;
  /** Incluir texto abaixo do código (apenas para Code 128) */
  includetext?: boolean;
  /** Tamanho da fonte do texto */
  textsize?: number;
}

/**
 * Helper para renderizar código de barras em canvas e retornar data URL
 * Funciona no browser usando a API canvas do bwip-js
 */
async function renderToDataURL(options: BwipOptions): Promise<string> {
  // Criar canvas dinamicamente
  const canvas = document.createElement("canvas");

  try {
    // Renderizar no canvas usando a API browser do bwip-js
    bwipjs.toCanvas(canvas, options);

    // Converter canvas para data URL
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Erro ao renderizar código de barras:", error);
    throw error;
  }
}

/**
 * Gera código Data Matrix como data URL (base64)
 * Dimensões recomendadas: 25x25mm na impressão
 *
 * @param data String de 160 caracteres para o Data Matrix Correios
 * @param options Opções de renderização
 * @returns Data URL da imagem PNG
 */
export async function generateDataMatrix(
  data: string,
  options: BarcodeOptions = {}
): Promise<string> {
  const { scale = 3, barcolor = "000000", backgroundcolor = "FFFFFF" } = options;

  try {
    return await renderToDataURL({
      bcid: "datamatrix",
      text: data,
      scale,
      barcolor,
      backgroundcolor,
      padding: 2,
    });
  } catch (error) {
    console.error("Erro ao gerar Data Matrix:", error);
    throw new Error("Falha ao gerar código Data Matrix");
  }
}

/**
 * Gera código de barras Code 128 como data URL
 * Usado para o CEP do destinatário
 * Dimensões recomendadas: 15x40mm na impressão
 *
 * @param data CEP (8 dígitos)
 * @param options Opções de renderização
 * @returns Data URL da imagem PNG
 */
export async function generateCode128(
  data: string,
  options: BarcodeOptions = {}
): Promise<string> {
  const {
    scale = 2,
    barcolor = "000000",
    backgroundcolor = "FFFFFF",
    includetext = true,
    textsize = 10,
  } = options;

  try {
    return await renderToDataURL({
      bcid: "code128",
      text: data,
      scale,
      height: 10,
      barcolor,
      backgroundcolor,
      includetext,
      textxalign: "center",
      textsize,
    });
  } catch (error) {
    console.error("Erro ao gerar Code 128:", error);
    throw new Error("Falha ao gerar código de barras Code 128");
  }
}

/**
 * Gera código de barras GS1-128 como data URL
 * Usado para o código de rastreamento
 * Dimensões recomendadas: 15x90mm na impressão
 *
 * @param trackingCode Código de rastreamento (13 caracteres)
 * @param options Opções de renderização
 * @returns Data URL da imagem PNG
 */
export async function generateGS1128(
  trackingCode: string,
  options: BarcodeOptions = {}
): Promise<string> {
  const {
    scale = 2,
    barcolor = "000000",
    backgroundcolor = "FFFFFF",
    includetext = true,
    textsize = 10,
  } = options;

  try {
    return await renderToDataURL({
      bcid: "code128",
      text: trackingCode,
      scale,
      height: 12,
      barcolor,
      backgroundcolor,
      includetext,
      textxalign: "center",
      textsize,
    });
  } catch (error) {
    console.error("Erro ao gerar GS1-128:", error);
    throw new Error("Falha ao gerar código de barras GS1-128");
  }
}

/**
 * Gera todos os códigos de barras necessários para uma etiqueta Correios
 */
export interface LabelBarcodes {
  dataMatrix: string;
  trackingBarcode: string;
  cepBarcode: string;
}

export async function generateAllBarcodes(
  dataMatrixString: string,
  trackingCode: string,
  cepDestino: string
): Promise<LabelBarcodes> {
  const [dataMatrix, trackingBarcode, cepBarcode] = await Promise.all([
    generateDataMatrix(dataMatrixString),
    generateGS1128(trackingCode),
    generateCode128(cepDestino.replace(/\D/g, "")),
  ]);

  return {
    dataMatrix,
    trackingBarcode,
    cepBarcode,
  };
}

/**
 * Hook React para gerar códigos de barras de forma assíncrona
 * Retorna null enquanto carrega, ou os códigos prontos
 */
export function useBarcodes(
  dataMatrixString: string | null,
  trackingCode: string | null,
  cepDestino: string | null
) {
  return {
    generateAll: async () => {
      if (!dataMatrixString || !trackingCode || !cepDestino) {
        return null;
      }
      return generateAllBarcodes(dataMatrixString, trackingCode, cepDestino);
    },
  };
}
