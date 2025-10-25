import { NextResponse } from "next/server";
import { dashboardHighlights, recentActivities } from "@/lib/api/data";

export const dynamic = "force-dynamic";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 350));

  return NextResponse.json({
    destaques: dashboardHighlights,
    atividadesRecentes: recentActivities,
  });
}
