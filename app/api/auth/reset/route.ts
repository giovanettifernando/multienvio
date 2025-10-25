import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

type ResetTokenEntry = {
  email: string;
  expiresAt: number;
};

declare global {
  var __envioResetTokens: Map<string, ResetTokenEntry> | undefined;
}

const senhaRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\S]{8,}$/;

const resetPayloadSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  senha: z
  .string()
  .min(1, "Informe a nova senha")
  .regex(
    senhaRegex,
    "A senha deve ter 8 caracteres, letra maiúscula, minúscula e número",
  ),
});

function getTokenStore(): Map<string, ResetTokenEntry> {
  if (!globalThis.__envioResetTokens) {
    globalThis.__envioResetTokens = new Map();
  }
  return globalThis.__envioResetTokens;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = resetPayloadSchema.parse(payload);
    const { token } = parsed;

    await new Promise((resolve) => setTimeout(resolve, 350));

    const tokenStore = getTokenStore();
    const tokenData = tokenStore.get(token);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      tokenStore.delete(token);
      return NextResponse.json(
        {
          mensagem: "O link de redefinição expirou ou é inválido.",
          code: "TOKEN_INVALID",
        },
        { status: 400 },
      );
    }

    tokenStore.delete(token);

    console.info(
      `[reset-password] Senha redefinida para ${tokenData.email} (mock).`,
    );

    return NextResponse.json({ ok: true });
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
      {
        mensagem: "Não foi possível redefinir a senha.",
      },
      { status: 500 },
    );
  }
}
