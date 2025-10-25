import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { forgotSchema } from "@/lib/validation/auth";

type ResetTokenEntry = {
  email: string;
  expiresAt: number;
};

type AttemptRegistry = Map<string, number[]>;

declare global {
  var __envioResetTokens: Map<string, ResetTokenEntry> | undefined;
  var __envioResetAttempts: AttemptRegistry | undefined;
}

const RESET_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const ATTEMPT_LIMIT = 3;

function getTokenStore(): Map<string, ResetTokenEntry> {
  if (!globalThis.__envioResetTokens) {
    globalThis.__envioResetTokens = new Map();
  }
  return globalThis.__envioResetTokens;
}

function getAttemptStore(): AttemptRegistry {
  if (!globalThis.__envioResetAttempts) {
    globalThis.__envioResetAttempts = new Map();
  }
  return globalThis.__envioResetAttempts;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { email } = forgotSchema.parse(payload);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const tokenStore = getTokenStore();
    const attemptStore = getAttemptStore();

    const now = Date.now();
    const attempts = attemptStore.get(email) ?? [];
    const recentAttempts = attempts.filter(
      (timestamp) => now - timestamp <= ATTEMPT_WINDOW_MS,
    );
    recentAttempts.push(now);
    attemptStore.set(email, recentAttempts);

    const rateLimited = recentAttempts.length > ATTEMPT_LIMIT;
    if (rateLimited) {
      console.warn(
        `[reset-password] Rate limit triggered for ${email} (${recentAttempts.length} tentativas)`,
      );
    }

    if (process.env.NODE_ENV !== "production") {
      const token = nanoid(32);
      tokenStore.set(token, {
        email,
        expiresAt: now + RESET_WINDOW_MS,
      });

      return NextResponse.json({
        ok: true,
        previewUrl: `/auth/reset/${token}`,
      });
    }

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
      { mensagem: "Não foi possível processar a solicitação." },
      { status: 500 },
    );
  }
}
