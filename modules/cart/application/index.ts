/**
 * Cart Module - Application Layer
 *
 * Exporta todas as funções e tipos dos serviços do carrinho.
 */

// =============================================================================
// Cart Service - CRUD de carrinho
// =============================================================================
export {
  type CartDto,
  type CartItemDto,
  type CartTotals,
  type CartServiceDeps,
  getOpenCart,
  getOrCreateOpenCart,
  clearCart,
  recalculateCartTotals,
  getOpenCartId,
  verifyCartOwnership,
  // Mappers (for testing)
  mapCartToDto,
  mapCartItemToDto,
  calculateCartTotal,
} from './cart.service';

// =============================================================================
// Cart Items Service - Gestão de itens
// =============================================================================
export {
  type CartItemDto as CartItemDetailDto,
  addItem,
  updateItem,
  deleteItem,
  listItems,
  getItem,
} from './cart-items.service';

// =============================================================================
// Checkout Service - Processamento de checkout
// =============================================================================
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

// =============================================================================
// Cart Checkout Service - Checkout do carrinho
// =============================================================================
export {
  type CartCheckoutInput,
  type CartCheckoutResult,
  processCartCheckout,
} from './cart-checkout.service';
