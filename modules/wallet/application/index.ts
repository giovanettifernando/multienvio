/**
 * Wallet Application Layer Exports
 */

// Debit Service
export {
  processDebit,
  toCents,
  toReais,
  generateTransactionTitle,
  buildReferenceId,
  validateBalance,
  DebitErrorCodes,
  type DebitInput,
  type DebitResult,
  type DebitServiceDeps,
} from './debit.service';

// Statement Service
export {
  getWalletStatement,
  mapTransactionsToDTO,
  type StatementFilters,
  type StatementPagination,
  type StatementServiceDeps,
} from './statement.service';

// Balance Service
export {
  getWalletOverview,
  type BalanceServiceDeps,
} from './balance.service';

// Wallet Service
export * from './wallet.service';

// Period Summary
export * from './period-summary';

// Transaction Direction
export * from './transaction-direction';
