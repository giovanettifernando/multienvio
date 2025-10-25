import { NextResponse } from "next/server";

const recipients = [
  {
    id: "rec-1",
    nome: "Maria Silva",
    telefone: "(11) 99999-0000",
    email: "maria@example.com",
    documento: "123.456.789-00",
    cep: "01005-010",
    logradouro: "Rua das Flores",
    numero: "200",
    complemento: "Apto 12",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    observacoes: "Interfonar no 12",
  },
  {
    id: "rec-2",
    nome: "João Pereira",
    telefone: "(11) 98888-1111",
    documento: "987.654.321-00",
    cep: "01005-010",
    logradouro: "Rua das Flores",
    numero: "350",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cep = searchParams.get("cep");
  if (!cep) {
    return NextResponse.json([]);
  }
  return NextResponse.json(recipients.filter((recipient) => recipient.cep === cep));
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ ...body, id: `rec-${Date.now()}` });
}
