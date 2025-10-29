import { NextRequest, NextResponse } from "next/server";
import type { Profile } from "@/types/account";

export const dynamic = "force-dynamic";

declare global {
  var __envioProfile: Profile | undefined;
}

function getProfileStore(): Profile {
  if (!globalThis.__envioProfile) {
    globalThis.__envioProfile = {
      fullName: "Usuário Envio Legal",
      email: "user@example.com",
      phone: "41999999999",
      cpf: "00000000000",
      hasCompany: false,
      company: null,
      avatarDataUrl: null,
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
  return NextResponse.json(body);
}
