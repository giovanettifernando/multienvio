import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type CepRouteParams = Promise<{ cep: string }>;

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function GET(_request: NextRequest, context: { params: CepRouteParams }) {
  try {
    const { cep } = await context.params;

    // Remove qualquer formatação para validar apenas dígitos
    const digits = cep.replace(/\D/g, '');

    // Valida se tem 8 dígitos
    if (digits.length !== 8) {
      return NextResponse.json(
        { error: "CEP inválido. Deve conter 8 dígitos." },
        { status: 400 }
      );
    }

    // Consulta ViaCEP
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Erro ao consultar CEP" },
        { status: 500 }
      );
    }

    const data: ViaCepResponse = await response.json();

    // ViaCEP retorna {erro: true} quando CEP não existe
    if (data.erro) {
      return NextResponse.json(
        { error: "CEP não encontrado" },
        { status: 404 }
      );
    }

    // Retorna dados formatados
    return NextResponse.json({
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.localidade,
      uf: data.uf,
    });
  } catch (error) {
    console.error('[GET /api/cep/[cep]] Error:', error);
    return NextResponse.json(
      { error: "Erro ao buscar CEP" },
      { status: 500 }
    );
  }
}
