import type { CompanyWizardData } from '@/shared/validation/company';

type LegacyCompany = {
  empresa?: unknown;
  endereco?: unknown;
  preferencias?: unknown;
};

export function adaptLegacyCompany(
  data: Partial<CompanyWizardData> | LegacyCompany | null | undefined,
): Partial<CompanyWizardData> | null {
  if (!data) return null;

  if (typeof data === "object" && data !== null && "tipoPessoa" in data) {
    return data as Partial<CompanyWizardData>;
  }

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const legacy = data as LegacyCompany;

  return {
    tipoPessoa: "PJ",
    empresa: legacy.empresa as CompanyWizardData["empresa"] | undefined,
    endereco: legacy.endereco as CompanyWizardData["endereco"],
    preferencias: legacy.preferencias as CompanyWizardData["preferencias"],
  } as Partial<CompanyWizardData>;
}
