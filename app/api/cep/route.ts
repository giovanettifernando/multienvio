import { NextResponse } from "next/server";
import { formatCEP, onlyDigits } from "@/lib/masks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cepParam = searchParams.get("cep") ?? "";
  const digits = onlyDigits(cepParam).slice(0, 8);

  await new Promise((resolve) => setTimeout(resolve, 380));

  if (digits.length !== 8) {
    return NextResponse.json({
      found: false,
      mensagem: "Não encontramos o CEP informado. Verifique e tente novamente.",
    });
  }

  const formatted = formatCEP(digits);
  return NextResponse.json({
    found: true,
    cep: formatted,
    logradouro: "Rua Exemplo",
    bairro: "Centro",
    cidade: "Curitiba",
    uf: "PR",
  });
}
