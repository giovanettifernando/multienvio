import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { QuoteRequestPayload, QuoteResultItem, PartnerPoint } from "@/types/quote";

const mockCarriers: QuoteResultItem[] = [
  {
    id: `quote-${nanoid(6)}`,
    carrier: "Correios",
    modalidade: "SEDEX",
    prazoDias: 2,
    preco: 38.9,
    exigeSeguro: false,
  },
  {
    id: `quote-${nanoid(6)}`,
    carrier: "Azul Cargo",
    modalidade: "Next Day",
    prazoDias: 1,
    preco: 52.4,
    exigeSeguro: true,
  },
  {
    id: `quote-${nanoid(6)}`,
    carrier: "JadLog",
    modalidade: "Econômico",
    prazoDias: 4,
    preco: 29.9,
    exigeSeguro: false,
  },
];

const partnerPoints: PartnerPoint[] = [
  {
    id: "pp-1",
    nome: "Loja Parceira Central",
    distanciaKm: 1.2,
    enderecoCurto: "Av. Central, 100 - Centro",
  },
  {
    id: "pp-2",
    nome: "Mercado 24h",
    distanciaKm: 2.5,
    enderecoCurto: "Rua das Flores, 200 - Jardim",
  },
];

export async function POST(request: Request) {
  const body = (await request.json()) as QuoteRequestPayload;

  const results = mockCarriers.map((item, index) => ({
    ...item,
    id: `${item.id}-${index}`,
    preco: Number((item.preco + index * 3.2).toFixed(2)),
    prazoDias: item.prazoDias + index,
    exigeSeguro: index === 1 ? true : item.exigeSeguro,
  }));

  const response = {
    results,
    pontosParceiros: body.coleta ? [] : partnerPoints,
  };

  return NextResponse.json(response);
}
