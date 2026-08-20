/**
 * Monta remetente e destinatário da declaração de conteúdo a partir do envio.
 *
 * Existe porque duas saídas diferentes precisam exatamente dos mesmos dados —
 * o download avulso da declaração e a declaração anexada à etiqueta — e as
 * duas montavam esse bloco por conta própria, lendo o endereço do CADASTRO do
 * usuário (`sender.addresses[0]`). Isso mostra o endereço de hoje, não o de
 * quem enviou: quem trocou de endereço via a declaração de um envio antigo
 * sair com o endereço errado.
 *
 * Agora a origem congelada no envio manda, e o cadastro só entra como reserva
 * para envios criados antes de esses campos existirem.
 */

import { formatEndereco } from '@/shared/utils/address';
import type {
  DeclaracaoConteudoDestinatario,
  DeclaracaoConteudoRemetente,
} from '@/shared/docs/correios/declaracao-conteudo-pdf';

type ShipmentParties = {
  senderName: string | null;
  senderDocument: string | null;
  originCep: string;
  originAddress: string | null;
  originNeighborhood: string | null;
  originCity: string | null;
  originState: string | null;
  recipientName: string | null;
  recipientDocument: string | null;
  destinationCep: string;
  destinationAddress: string | null;
  destinationNeighborhood: string | null;
  destinationCity: string;
  destinationState: string;
};

type SenderFallback = {
  name: string | null;
  razaoSocial: string | null;
  cpf: string | null;
  cnpj: string | null;
} | null;

type AddressFallback = {
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
} | null;

export function buildRemetente(
  shipment: ShipmentParties,
  sender: SenderFallback,
  senderAddress: AddressFallback
): DeclaracaoConteudoRemetente {
  const enderecoCongelado = shipment.originAddress
    ? shipment.originNeighborhood
      ? `${shipment.originAddress} - ${shipment.originNeighborhood}`
      : shipment.originAddress
    : null;

  const cidadeUfCongelada =
    shipment.originCity && shipment.originState
      ? `${shipment.originCity} - ${shipment.originState}`
      : null;

  return {
    nome: shipment.senderName || sender?.razaoSocial || sender?.name || '—',
    documento: shipment.senderDocument || sender?.cnpj || sender?.cpf || null,
    endereco:
      enderecoCongelado ?? (senderAddress ? formatEndereco(senderAddress) : '—'),
    cidadeUf:
      cidadeUfCongelada ??
      (senderAddress ? `${senderAddress.cidade} - ${senderAddress.uf}` : '—'),
    cep: shipment.originCep,
  };
}

export function buildDestinatario(shipment: ShipmentParties): DeclaracaoConteudoDestinatario {
  const endereco = shipment.destinationAddress
    ? shipment.destinationNeighborhood
      ? `${shipment.destinationAddress} - ${shipment.destinationNeighborhood}`
      : shipment.destinationAddress
    : '—';

  return {
    nome: shipment.recipientName || '—',
    documento: shipment.recipientDocument || null,
    endereco,
    cidadeUf: `${shipment.destinationCity} - ${shipment.destinationState}`,
    cep: shipment.destinationCep,
  };
}
