import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type CepRouteParams = Promise<{ cep: string }>;

export async function GET(_request: NextRequest, context: { params: CepRouteParams }) {
  const { cep } = await context.params;
  const valido = /^\d{5}-\d{3}$/.test(cep);
  if (!valido) {
    return NextResponse.json(
      { cep, valido: false, mensagemErro: "CEP inválido" },
      { status: 200 },
    );
  }
  return NextResponse.json({ cep, valido: true, cidade: "Curitiba", uf: "PR" });
}
