import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { loginSchema } from "@/lib/validation/auth";

export const dynamic = "force-dynamic";

// Mock de usuários para desenvolvimento
// Em produção, isso deve ser substituído por autenticação real com banco de dados
const MOCK_USERS = [
  {
    email: "demo@enviolegal.com",
    password: "demo123",
    name: "Usuário Demo",
    id: "user_demo_001",
  },
  {
    email: "admin@enviolegal.com",
    password: "admin123",
    name: "Administrador",
    id: "user_admin_001",
  },
];

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const dados = loginSchema.parse(payload);

    // Simular delay de rede
    await new Promise((resolve) => setTimeout(resolve, 500));

    const email = dados.email.toLowerCase();

    // Casos de teste especiais
    if (email.includes("invalido@")) {
      return NextResponse.json(
        { mensagem: "Credenciais inválidas" },
        { status: 401 },
      );
    }

    if (email.includes("pendente@")) {
      return NextResponse.json(
        { mensagem: "Conta pendente de confirmação" },
        { status: 423 },
      );
    }

    // Verificar credenciais mock
    const user = MOCK_USERS.find((u) => u.email === email);

    if (!user || user.password !== dados.senha) {
      return NextResponse.json(
        { mensagem: "E-mail ou senha inválidos" },
        { status: 401 },
      );
    }

    // Retornar dados do usuário autenticado
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      token: `${process.env.NODE_ENV === "production" ? "prod" : "dev"}-token-${nanoid(16)}`,
    });
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
      { mensagem: "Não foi possível realizar o login." },
      { status: 500 },
    );
  }
}
