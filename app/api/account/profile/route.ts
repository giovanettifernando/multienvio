import { NextRequest, NextResponse } from "next/server";
import type { Profile } from "@/types/account";

export const dynamic = "force-dynamic";

declare global {
  var __envioProfile: Profile | undefined;
}

function getProfileStore(): Profile {
  if (!globalThis.__envioProfile) {
    globalThis.__envioProfile = {
      pf: {
        nome: "Usuário",
        email: "user@ex.com",
        telefone: "41999999999",
        cpf: "00000000000",
        nascimento: undefined,
      },
      pj: undefined,
    };
  }
  return globalThis.__envioProfile;
}

export async function GET() {
  const profile = getProfileStore();
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Profile;
  globalThis.__envioProfile = body;
  return NextResponse.json({ ok: true, profile: body });
}
