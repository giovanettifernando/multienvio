import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  companyWizardSchema,
  type CompanyWizardData,
} from "@/lib/validation/company";

export const dynamic = "force-dynamic";

function getCompany(): CompanyWizardData | null {
  return globalThis.__envioCompany ?? null;
}

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const data = getCompany();
  return NextResponse.json({ company: data, hasCompany: Boolean(data) });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = companyWizardSchema.parse(payload);

    await new Promise((resolve) => setTimeout(resolve, 700));

    globalThis.__envioCompany = data;

    return NextResponse.json({ company: data, hasCompany: true });
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
      { mensagem: "Não foi possível salvar os dados da empresa." },
      { status: 500 },
    );
  }
}
