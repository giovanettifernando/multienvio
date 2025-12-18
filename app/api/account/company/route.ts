import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import {
  companyWizardSchema,
  type CompanyWizardData,
} from '@/shared/validation/company';

type GetCompanyResponse = {
  company: CompanyWizardData | null;
  hasCompany: boolean;
};

type CreateCompanyResponse = {
  company: CompanyWizardData;
  hasCompany: boolean;
};

function getCompany(): CompanyWizardData | null {
  return globalThis.__envioCompany ?? null;
}

export const GET = withApiHandler<GetCompanyResponse>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const data = getCompany();
  return {
    data: {
      company: data,
      hasCompany: Boolean(data)
    }
  };
});

export const POST = withApiHandler<CreateCompanyResponse>(async (context) => {
  const payload = await context.req.json();

  // Validar dados com Zod
  const validation = companyWizardSchema.safeParse(payload);
  if (!validation.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: {
        erros: validation.error.issues.map((issue) => ({
          campo: issue.path.join("."),
          mensagem: issue.message,
        })),
      },
    });
  }

  const data = validation.data;

  await new Promise((resolve) => setTimeout(resolve, 700));

  globalThis.__envioCompany = data;

  return {
    data: {
      company: data,
      hasCompany: true
    }
  };
});
