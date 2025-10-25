import type { StoredShipment } from "@/types/shipment";
import type { CompanyWizardData } from "@/lib/validation/company";

declare global {
  // eslint-disable-next-line no-var
  var __envioShipments: Map<string, StoredShipment> | undefined;

  // eslint-disable-next-line no-var
  var __envioCompany: CompanyWizardData | undefined;
}

export {};
