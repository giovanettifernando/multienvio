import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { cadastroSchema } from "@/lib/validation/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const dados = cadastroSchema.parse(payload);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const emailNormalizado = dados.email
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (emailNormalizado.endsWith("@ja.com")) {
      return NextResponse.json(
        { mensagem: "E-mail já cadastrado" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        id: nanoid(),
        name: dados.nomeCompleto,
        email: dados.email,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          mensagem: "Dados inválidos",
          erros: error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensagem: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { mensagem: "Não foi possível concluir o cadastro." },
      { status: 500 },
    );
  }
}
