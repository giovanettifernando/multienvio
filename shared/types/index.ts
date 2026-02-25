// Shared Types - Domain Types
// Note: Contracts is the source of truth for core types (Address, Shipment, etc.)
// Other modules extend or add specific variations

// Core types from contracts
export * from './contracts';

// Account types (Profile, Card, etc.) - Address is from contracts
export type { Profile, PasswordChange, Card, Recipient, RecipientList } from './account';

// Extended address types
export type {
  AddressCreatePayload,
  AddressListResponse,
  AddressCreateResponse,
  AddressSelectOption,
} from './address';

// Billing types (re-export all without conflicts)
export type { LedgerType, LedgerSource, LedgerEntry, CardMethod, PixTopup } from './billing';
export type { Invoice as BillingInvoice } from './billing';

// Other domain types without conflicts
export * from './cart';
export * from './order';
export * from './quote';
export * from './quoteFinalize';
export * from './support';
export * from './tracking';
export * from './wallet';
export * from './wallet-statement';
export * from './correios-label';
export * from './invoice';
export * from './label';
export * from './pickup';

// Extended shipment types (core Shipment is from contracts)
export type {
  ShipmentFormData,
  ShipmentTag,
  StoredShipment,
  ShipmentRecord,
} from './shipment';
