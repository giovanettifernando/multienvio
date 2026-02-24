/**
 * Extração de itens de declaração de conteúdo do documento do shipment.
 *
 * Suporta dois formatos:
 * - Novo: `volumeDeclarations[].items[]`
 * - Legado: `declarationItems[]`
 */

import type { DeclaracaoConteudoItem } from './declaracao-conteudo-pdf';

export interface DocumentDeclarationItem {
  descricao?: string;
  valorUnitario?: number;
  quantidade?: number;
}

export interface VolumeDeclaration {
  volumeIndex?: number;
  items?: DocumentDeclarationItem[];
}

export interface ShipmentDocument {
  type?: string;
  declarationItems?: DocumentDeclarationItem[];
  volumeDeclarations?: VolumeDeclaration[];
}

/**
 * Extrai itens de declaração de conteúdo do documento JSON do shipment.
 * Retorna array vazio se o documento não for do tipo DECLARACAO ou não tiver itens.
 */
export function extractDeclarationItems(document: ShipmentDocument | null): DeclaracaoConteudoItem[] {
  if (!document || document.type !== 'DECLARACAO') {
    return [];
  }

  const items: DeclaracaoConteudoItem[] = [];

  // Formato novo: volumeDeclarations
  if (document.volumeDeclarations && Array.isArray(document.volumeDeclarations)) {
    for (const vol of document.volumeDeclarations) {
      if (vol.items && Array.isArray(vol.items)) {
        for (const item of vol.items) {
          if (item.descricao) {
            items.push({
              descricao: item.descricao,
              quantidade: item.quantidade || 1,
              valor: (item.valorUnitario || 0) * (item.quantidade || 1),
            });
          }
        }
      }
    }
  }

  // Formato legado: declarationItems
  if (items.length === 0 && document.declarationItems && Array.isArray(document.declarationItems)) {
    for (const item of document.declarationItems) {
      if (item.descricao) {
        items.push({
          descricao: item.descricao,
          quantidade: item.quantidade || 1,
          valor: (item.valorUnitario || 0) * (item.quantidade || 1),
        });
      }
    }
  }

  return items;
}
