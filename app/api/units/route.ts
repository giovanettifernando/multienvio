import { NextResponse } from "next/server";

const units = [
  {
    id: "unit-1",
    nome: "Agência Central",
    cep: "01001-000",
    endereco: "Av. Principal, 100",
    cidade: "São Paulo",
    uf: "SP",
  },
  {
    id: "unit-2",
    nome: "Posto Jardim",
    cep: "01005-010",
    endereco: "Rua das Flores, 200",
    cidade: "São Paulo",
    uf: "SP",
  },
  {
    id: "unit-3",
    nome: "Agência Campinas",
    cep: "13010-001",
    endereco: "Rua XV de Novembro, 50",
    cidade: "Campinas",
    uf: "SP",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ampliar = searchParams.get("ampliar") === "true";
  const estados = searchParams.get("estadosProximos") === "true";

  if (ampliar || estados) {
    return NextResponse.json(units);
  }
  return NextResponse.json(units.slice(0, 2));
}
