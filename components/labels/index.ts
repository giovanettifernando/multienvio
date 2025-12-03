/**
 * Exports for label components
 */

export { EtiquetaCorreios } from "./EtiquetaCorreios";
export { EtiquetaGenerica } from "./EtiquetaGenerica";
export { RoutingSymbolIcon } from "./RoutingSymbols";
export { LabelRenderer, type LabelData } from "./LabelRenderer";
export { LabelPrintModal } from "./LabelPrintModal";
export { ShipmentLabelModal, type ShipmentLabelData } from "./ShipmentLabelModal";

// Re-export types
export type {
  CorreiosLabelData,
  GenericLabelData,
  RoutingSymbol,
  AdditionalServices,
  LabelAddress,
  LabelVolume,
} from "@/types/correios-label";
