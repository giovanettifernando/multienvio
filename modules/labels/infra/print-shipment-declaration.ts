/**
 * Impressão da declaração de conteúdo (ou espelho de NF-e) de um envio.
 *
 * Fica separado da tela porque dois lugares precisam do mesmo documento: a
 * tela de detalhe do envio, que já tem os dados carregados, e a listagem, que
 * só tem o id e precisa buscá-los. Manter a montagem do payload em um lugar só
 * evita que as duas impressões saiam diferentes.
 *
 * Desde 01/09/2026 este caminho só atende NF-e. A declaração de conteúdo em
 * papel deixou de ser oferecida — foi substituída pela DC-e, emitida pelo
 * cliente na SEFAZ. O gerador da declaração continua em `document-pdf.ts`,
 * intacto, para reativar caso o papel volte a ser aceito.
 */

import { printDocumentPDF, type ShipmentInfo, type VolumeData } from './document-pdf';

/** Recorte da resposta de GET /api/shipments/[id] usado para imprimir. */
export type PrintableShipment = {
  platformTrackingCode: string;
  carrier: string | null;
  service: string | null;
  senderName: string | null;
  senderDocument: string | null;
  recipientName: string | null;
  recipientDocument: string | null;
  originCep: string;
  originAddress: string | null;
  originNeighborhood: string | null;
  originCity: string | null;
  originState: string | null;
  destinationCep: string;
  destinationCity: string;
  destinationState: string;
  destinationAddress: string | null;
  destinationNeighborhood: string | null;
  createdAt: string;
  documentType: string;
  nfeKeys?: string[];
  volumes: Array<{
    packageNumber: number;
    weight: number;
    width: number;
    height: number;
    length: number;
    items?: Array<{
      descricao: string;
      quantidade: number;
      valorUnitario: number;
      subtotal?: number;
    }>;
  }>;
};

export function isNFeShipment(shipment: Pick<PrintableShipment, 'documentType'>): boolean {
  return (shipment.documentType || '').toUpperCase() === 'NFE';
}

export function buildPrintPayload(shipment: PrintableShipment): {
  volumes: VolumeData[];
  info: ShipmentInfo;
} {
  const isNFe = isNFeShipment(shipment);

  const volumes: VolumeData[] = shipment.volumes.map((vol) => ({
    index: vol.packageNumber,
    documentType: isNFe ? 'NF' : 'DECLARATION',
    nfKey: shipment.nfeKeys?.[vol.packageNumber - 1],
    height: vol.height,
    width: vol.width,
    length: vol.length,
    weight: vol.weight,
    items: (vol.items || []).map((item) => ({
      description: item.descricao,
      quantity: item.quantidade,
      unitValue: item.valorUnitario,
      subtotal: item.subtotal,
    })),
  }));

  const info: ShipmentInfo = {
    trackingCode: shipment.platformTrackingCode,
    carrier: shipment.carrier || 'Não informado',
    service: shipment.service || 'Não informado',
    senderName: shipment.senderName,
    senderDocument: shipment.senderDocument,
    recipientName: shipment.recipientName,
    recipientDocument: shipment.recipientDocument,
    origin: {
      cep: shipment.originCep,
      address: shipment.originAddress,
      neighborhood: shipment.originNeighborhood,
      city: shipment.originCity,
      state: shipment.originState,
    },
    destination: {
      cep: shipment.destinationCep,
      city: shipment.destinationCity,
      state: shipment.destinationState,
      address: shipment.destinationAddress,
      neighborhood: shipment.destinationNeighborhood,
    },
    createdAt: shipment.createdAt,
  };

  return { volumes, info };
}

export function printShipmentDocument(shipment: PrintableShipment): void {
  const { volumes, info } = buildPrintPayload(shipment);
  printDocumentPDF(volumes, info);
}

/**
 * Busca o envio e imprime. Para telas que só têm o id em mãos.
 * @throws quando o envio não pode ser carregado ou não tem volumes.
 */
export async function fetchAndPrintShipmentDocument(shipmentId: string): Promise<void> {
  const res = await fetch(`/api/shipments/${shipmentId}`);
  if (!res.ok) {
    throw new Error('Não foi possível carregar os dados do envio.');
  }

  const body = (await res.json()) as { data?: PrintableShipment };
  const shipment = body.data;

  if (!shipment || !shipment.volumes?.length) {
    throw new Error('Este envio não tem volumes para imprimir.');
  }

  // A declaração de conteúdo em papel saiu de circulação em 01/09/2026: o
  // documento válido é a DC-e, que o cliente emite na SEFAZ e imprime de lá.
  // A recusa vive aqui, e não na tela, porque a listagem não sabe o tipo do
  // documento — assim qualquer chamador recebe a mesma explicação.
  if (!isNFeShipment(shipment)) {
    throw new Error(
      'A declaração em papel foi substituída pela DC-e. Imprima o documento no portal da SEFAZ, com a chave informada no envio.'
    );
  }

  printShipmentDocument(shipment);
}
