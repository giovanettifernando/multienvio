import { nanoid } from "nanoid";
import type { PacoteQuoteInput, PreferenciasQuoteInput } from "@/lib/validation/quote";
import type { QuoteResult } from "@/components/ui/QuoteResultCard";

type QuoteTemplate = {
  serviceCode: string;
  name: string;
  carrier: "Correios" | "Jadlog" | "Loggi" | "J&T";
  basePrice: number;
  baseEtaRange: [number, number];
  tags: string[];
};

const templates: QuoteTemplate[] = [
  {
    serviceCode: "PAC",
    name: "PAC",
    carrier: "Correios",
    basePrice: 18.9,
    baseEtaRange: [3, 5],
    tags: ["Terrestre", "Coleta", "Porta a porta", "Rastreamento"],
  },
  {
    serviceCode: "PACKAGE",
    name: "Package",
    carrier: "Jadlog",
    basePrice: 24.5,
    baseEtaRange: [2, 3],
    tags: ["Terrestre", "Coleta", "Rastreamento"],
  },
  {
    serviceCode: "NEXT",
    name: "Next",
    carrier: "Loggi",
    basePrice: 32.8,
    baseEtaRange: [1, 2],
    tags: ["Expressa", "Coleta", "Porta a porta"],
  },
  {
    serviceCode: "JET-EXPRESS",
    name: "Express",
    carrier: "J&T",
    basePrice: 27.6,
    baseEtaRange: [2, 4],
    tags: ["Aéreo", "Porta a porta", "Rastreamento"],
  },
];

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateMockQuotes({
  pacote,
  preferencias,
}: {
  pacote: PacoteQuoteInput;
  preferencias: PreferenciasQuoteInput;
}): QuoteResult[] {
  const volumeCm3 = pacote.comprimentoCm * pacote.larguraCm * pacote.alturaCm;
  const pesoCubico = volumeCm3 / 6000;
  const pesoConsiderado = Math.max(pacote.pesoKg, pesoCubico);
  const prioridade = preferencias.prioridade ?? 0;
  const prioridadeFactor = prioridade / 100;

  return templates.map((template, index) => {
    const weightMultiplier = 1 + pesoConsiderado / 20;
    const priorityMultiplier =
      1 + (template.carrier === "Loggi" ? prioridadeFactor * 0.35 : prioridadeFactor * 0.2);
    const insuranceMultiplier = preferencias.adicionais.seguro ? 1.05 : 1;
    const declaredValueMultiplier = 1 + pacote.valorDeclarado / 10000;

    const basePrice =
      template.basePrice *
      weightMultiplier *
      priorityMultiplier *
      insuranceMultiplier *
      declaredValueMultiplier *
      (1 + index * 0.04);

    const price = roundCurrency(basePrice);
    const [etaMin, etaMax] = template.baseEtaRange;
    const etaRangeAdjustment = prioridadeFactor > 0.6 ? -1 : 0;
    const etaDays = Math.max(1, Math.round((etaMin + etaMax) / 2 + etaRangeAdjustment));
    const deliveryDate = new Date(Date.now() + etaDays * 24 * 60 * 60 * 1000);

    return {
      id: nanoid(),
      serviceCode: template.serviceCode,
      name: template.name,
      carrier: template.carrier,
      etaDays,
      etaRange: template.baseEtaRange,
      price,
      badges: template.tags,
      breakdown: {
        base: roundCurrency(price * 0.9),
        adjustments: [
          {
            label: "Fator peso/dimensão",
            value: roundCurrency(price * (weightMultiplier - 1)),
          },
          {
            label: "Adicionais",
            value: roundCurrency(price * (insuranceMultiplier - 1)),
          },
        ].filter((item) => item.value > 0),
        final: price,
      },
      estimatedDelivery: deliveryDate.toISOString(),
    };
  });
}
