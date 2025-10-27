import { NextResponse } from "next/server";
import { ROLE_GROUPS } from "@/lib/auth/roles";

export async function GET() {
  return NextResponse.json({ groups: ROLE_GROUPS });
}
