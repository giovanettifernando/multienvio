import type { StoredShipment } from "@/types/shipment";
import type { CompanyWizardData } from "@/lib/validation/company";

declare global {
   
  var __envioShipments: Map<string, StoredShipment> | undefined;

   
  var __envioCompany: CompanyWizardData | undefined;
}

export {};
