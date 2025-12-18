import type { StoredShipment } from '@/shared/types/shipment';
import type { CompanyWizardData } from '@/shared/validation/company';

declare global {
   
  var __envioShipments: Map<string, StoredShipment> | undefined;

   
  var __envioCompany: CompanyWizardData | undefined;
}

export {};
