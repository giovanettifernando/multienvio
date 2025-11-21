/**
 * Stores globais compartilhados entre rotas da API
 * Usa globalThis para persistência entre hot reloads
 */

import type { Address, Card, Profile } from "@/types/account";
import type { Cart } from "@/types/cart";

// Legacy Wallet type para mock/store (não usar em código novo)
type LegacyWalletTx = {
  id: string;
  date: string;
  type: string;
  origin: string;
  amount: number;
  balanceAfter: number;
  description?: string;
};

type LegacyWallet = {
  balance: number;
  currency: "BRL";
  transactions: LegacyWalletTx[];
};

// Addresses Store
declare global {
  var __envioAddresses: Address[] | undefined;
}

export function getAddressesStore(): Address[] {
  if (!globalThis.__envioAddresses) {
    globalThis.__envioAddresses = [];
  }
  return globalThis.__envioAddresses;
}

// Cards Store
declare global {
  var __envioCards: Card[] | undefined;
}

export function getCardsStore(): Card[] {
  if (!globalThis.__envioCards) {
    globalThis.__envioCards = [];
  }
  return globalThis.__envioCards;
}

// Profile Store
declare global {
  var __envioProfile: Profile | undefined;
}

export function getProfileStore(): Profile {
  if (!globalThis.__envioProfile) {
    globalThis.__envioProfile = {
      fullName: "Usuário Envio Legal",
      email: "user@example.com",
      phone: "41999999999",
      cpf: "00000000000",
      hasCompany: false,
      company: null,
      avatarDataUrl: null,
    };
  }
  return globalThis.__envioProfile;
}

// Cart Store
declare global {
  var __envioCart: Cart | undefined;
}

export function getCartStore(): Cart {
  if (!globalThis.__envioCart) {
    globalThis.__envioCart = {
      items: [],
      subtotal: 0,
      descontos: 0,
      taxas: 0,
      total: 0,
      currency: "BRL",
    };
  }
  return globalThis.__envioCart;
}

export function recomputeCartTotals(cart: Cart) {
  const subtotal = cart.items.reduce(
    (accumulator, item) => accumulator + item.preco * item.quantidade,
    0,
  );
  const descontos = 0;
  const taxas = 0;
  const total = subtotal - descontos + taxas;
  globalThis.__envioCart = { ...cart, subtotal, descontos, taxas, total };
}

/**
 * ⚠️ DEPRECATED: Legacy Wallet Store - NÃO USAR EM CÓDIGO NOVO
 *
 * Este store usa armazenamento in-memory e não persiste entre restarts.
 *
 * MIGRE PARA OS ENDPOINTS REAIS DO PRISMA:
 * - GET /api/wallet - Obter saldo da carteira
 * - POST /api/wallet/debit - Debitar da carteira
 * - POST /api/wallet/topups/pix - Criar topup PIX
 * - POST /api/wallet/topups/confirm - Confirmar topup
 * - GET /api/wallet/transactions - Listar transações
 *
 * Endpoint que ainda usa este store:
 * - /api/payments/topups/pix (deprecated - use /api/wallet/topups/pix)
 */
declare global {
  var __envioWallet: LegacyWallet | undefined;
}

export function getWalletStore(): LegacyWallet {
  if (!globalThis.__envioWallet) {
    globalThis.__envioWallet = {
      balance: 0,
      currency: "BRL",
      transactions: [],
    };
  }
  return globalThis.__envioWallet;
}

export function pushTx(
  tx: Pick<LegacyWalletTx, "type" | "origin" | "amount" | "description">,
) {
  const wallet = getWalletStore();
  const id = `tx_${Date.now()}`;
  const date = new Date().toISOString();
  wallet.balance = Number((wallet.balance + tx.amount).toFixed(2));
  const balanceAfter = wallet.balance;
  const full = { id, date, balanceAfter, ...tx };
  wallet.transactions.unshift(full);
  globalThis.__envioWallet = wallet;
  return full;
}
