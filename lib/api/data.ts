import { nanoid } from "nanoid";
import type { DashboardActivity, DashboardHighlights } from "@/types/dashboard";
import type { Shipment } from "@/types/shipment";
import type { QuoteResultItem, QuoteRequestPayload } from "@/types/quote";

export const dashboardHighlights: DashboardHighlights = {
  enviosMes: 128,
  economiaMedia: 18,
  satisfacaoClientes: 96,
  coletasAgendadas: 12,
};

export const recentActivities: DashboardActivity[] = [
  {
    id: nanoid(),
    descricao: "Etiqueta gerada para pedido #EL-9214",
    data: "2024-07-11T09:24:00-03:00",
    tipo: "etiqueta",
  },
  {
    id: nanoid(),
    descricao: "Entrega concluída em Fortaleza/CE",
    data: "2024-07-10T17:40:00-03:00",
    tipo: "entrega",
  },
  {
    id: nanoid(),
    descricao: "Novo agendamento de coleta para amanhã",
    data: "2024-07-10T14:10:00-03:00",
    tipo: "coleta",
  },
];

export const shipmentsMock: Shipment[] = [
  {
    id: nanoid(),
    codigoRastreio: "BR123456789BR",
    destinatario: "Mariana Costa",
    cidadeOrigem: "São Paulo/SP",
    cidadeDestino: "Rio de Janeiro/RJ",
    servico: "Expresso D+1",
    servicoCodigo: "EXPRESSO_D1",
    status: "em_rota_de_entrega",
    atualizadoEm: "2024-07-11T08:35:00-03:00",
    prazoEstimado: "12/07/2024",
    valorFrete: 29.9,
    tags: ["express"],
  },
  {
    id: nanoid(),
    codigoRastreio: "BR987654321BR",
    destinatario: "João Pereira",
    cidadeOrigem: "Campinas/SP",
    cidadeDestino: "Curitiba/PR",
    servico: "Econômico",
    servicoCodigo: "ECONOMICO",
    status: "em_transito",
    atualizadoEm: "2024-07-10T19:15:00-03:00",
    prazoEstimado: "15/07/2024",
    valorFrete: 18.7,
    tags: ["economico"],
  },
  {
    id: nanoid(),
    codigoRastreio: "BR192837465BR",
    destinatario: "Ana Souza",
    cidadeOrigem: "Belo Horizonte/MG",
    cidadeDestino: "Salvador/BA",
    servico: "Seguro Plus",
    servicoCodigo: "SEGURO_PLUS",
    status: "postado",
    atualizadoEm: "2024-07-09T16:05:00-03:00",
    prazoEstimado: "16/07/2024",
    valorFrete: 45.1,
    tags: ["seguro", "declarado"],
  },
  {
    id: nanoid(),
    codigoRastreio: "BR019283746BR",
    destinatario: "Carlos Alberto",
    cidadeOrigem: "Florianópolis/SC",
    cidadeDestino: "Porto Alegre/RS",
    servico: "Same Day Porto Alegre",
    servicoCodigo: "SAME_DAY_POA",
    status: "entregue",
    atualizadoEm: "2024-07-10T13:20:00-03:00",
    prazoEstimado: "10/07/2024",
    valorFrete: 58.2,
    tags: ["express"],
  },
  {
    id: nanoid(),
    codigoRastreio: "BR564738291BR",
    destinatario: "Camila Ribeiro",
    cidadeOrigem: "Recife/PE",
    cidadeDestino: "Maceió/AL",
    servico: "Expresso Nordeste",
    servicoCodigo: "EXPRESSO_NORDESTE",
    status: "aguardando_coleta",
    atualizadoEm: "2024-07-11T07:55:00-03:00",
    prazoEstimado: "13/07/2024",
    valorFrete: 34.5,
  },
  {
    id: nanoid(),
    codigoRastreio: "BR564738292BR",
    destinatario: "Pedro Lima",
    cidadeOrigem: "Brasília/DF",
    cidadeDestino: "Goiânia/GO",
    servico: "Econômico",
    servicoCodigo: "ECONOMICO",
    status: "pendente",
    atualizadoEm: "2024-07-08T10:22:00-03:00",
    prazoEstimado: "16/07/2024",
    valorFrete: 16.3,
  },
];

const baseOptions: QuoteResultItem[] = [
  {
    id: "expresso",
    carrier: "Envio Legal Express",
    modalidade: "Expresso D+1",
    prazoDias: 1,
    preco: 42.9,
    exigeSeguro: true,
  },
  {
    id: "economico",
    carrier: "Envio Legal Econômico",
    modalidade: "Econômico D+5",
    prazoDias: 5,
    preco: 26.5,
    exigeSeguro: false,
  },
  {
    id: "same_day",
    carrier: "Parceiro Flash",
    modalidade: "Same Day",
    prazoDias: 0,
    preco: 59.9,
    exigeSeguro: true,
  },
];

export function buildQuoteResultItems(payload: QuoteRequestPayload): QuoteResultItem[] {
  // Calculate total weight from all volumes
  const totalWeight = payload.volumes.reduce((sum, vol) => sum + vol.pesoKg, 0);
  const pesoMultiplier = Math.max(1, totalWeight / 2);
  const declaradoMultiplier =
    payload.seguro && payload.seguro > 200 ? 1.1 : 1.0;
  const coletaFee = payload.coleta ? 8.5 : 0;

  return baseOptions.map((option) => ({
    ...option,
    preco: Number(
      (
        option.preco *
          pesoMultiplier *
          declaradoMultiplier +
        coletaFee
      ).toFixed(2),
    ),
  }));
}
