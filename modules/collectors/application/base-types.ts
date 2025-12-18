/**
 * Base types for collectors module - no imports from other files in this directory
 * This breaks the circular dependency between types.ts and schemas.ts
 */

export type CollectorStatus = 'active' | 'inactive' | 'blocked';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
export type AccountType = 'corrente' | 'poupanca';

export type CommissionModel =
  | { kind: 'fixa'; amount: number }
  | { kind: 'porKm'; amountPerKm: number };

export type BankMethod =
  | { kind: 'pix'; pixType: PixKeyType; pixKey: string }
  | {
      kind: 'transfer';
      bankCode: string;
      branch: string;
      account: string;
      accountType: AccountType;
      holderName: string;
      holderCnpj: string;
    };
