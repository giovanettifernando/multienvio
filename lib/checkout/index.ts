/**
 * Checkout Module
 *
 * Exporta todas as funções e tipos do serviço de checkout
 */

export {
  // Tipos
  type CheckoutRecipient,
  type CheckoutVolume,
  type CheckoutNfePackage,
  type CheckoutDeclarationItem,
  type CheckoutVolumeDeclaration,
  type CheckoutDocument,
  type CheckoutOriginAddress,
  type CheckoutInput,
  type CheckoutResult,

  // Funções auxiliares
  validateDocumentHasItems,
  calculateDeclaredValue,
  prepareDocumentData,
  generatePlatformTrackingCode,
  determineInitialStatus,

  // Service principal
  saveRecipientIfRequested,
  processCheckout,
} from './checkout.service';
