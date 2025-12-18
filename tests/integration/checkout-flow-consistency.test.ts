/**
 * Testes de consistência do fluxo: checkout → pagamento → label
 *
 * Verifica que:
 * 1. O endpoint legado /api/carrinho/checkout retorna 410 Gone
 * 2. O código de /api/wallet/debit marca carrinho como CHECKED_OUT (verificação de código)
 * 3. O código de /api/shipments/[id]/payment emite label (verificação de código)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { POST as deprecatedCheckout } from '@/app/api/carrinho/checkout/route';
import * as fs from 'fs';
import * as path from 'path';

describe('Checkout Flow Consistency', () => {
  describe('/api/carrinho/checkout (deprecated)', () => {
    it('deve retornar 410 Gone para endpoint deprecado', async () => {
      const res = await deprecatedCheckout();
      const body = await res.json();

      assert.strictEqual(res.status, 410);
      assert.strictEqual(body.code, 'ENDPOINT_DEPRECATED');
      assert.strictEqual(body.migration.newEndpoint, '/api/cart/checkout');
    });
  });

  describe('/api/wallet/debit - Código fonte', () => {
    it('deve conter código para marcar carrinho como CHECKED_OUT', () => {
      const filePath = path.join(process.cwd(), 'app/api/wallet/debit/route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verificar que o código contém a lógica para CHECKED_OUT
      assert.ok(
        content.includes("status: 'CHECKED_OUT'"),
        'Deve conter código para marcar carrinho como CHECKED_OUT'
      );

      assert.ok(
        content.includes('cartItem.deleteMany'),
        'Deve conter código para remover itens do carrinho'
      );

      assert.ok(
        content.includes("status: 'LOCKED'"),
        'Deve buscar carrinho com status LOCKED'
      );
    });

    it('deve emitir label após pagamento', () => {
      const filePath = path.join(process.cwd(), 'app/api/wallet/debit/route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(
        content.includes("status: 'issued'"),
        'Deve conter código para emitir label (status: issued)'
      );

      assert.ok(
        content.includes('label.update'),
        'Deve conter código para atualizar label'
      );
    });
  });

  describe('/api/shipments/[id]/payment - Código fonte', () => {
    it('deve conter código para emitir label quando pagamento aprovado', () => {
      const filePath = path.join(process.cwd(), 'app/api/shipments/[id]/payment/route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verificar que o código contém a lógica para emitir label
      assert.ok(
        content.includes("status: 'issued'"),
        'Deve conter código para emitir label (status: issued)'
      );

      assert.ok(
        content.includes("status === 'approved'"),
        'Deve verificar se pagamento foi aprovado'
      );

      assert.ok(
        content.includes("label.status === 'pending'"),
        'Deve verificar se label está pendente antes de emitir'
      );
    });

    it('deve marcar carrinho como CHECKED_OUT após pagamento', () => {
      const filePath = path.join(process.cwd(), 'app/api/shipments/[id]/payment/route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(
        content.includes("status: 'CHECKED_OUT'"),
        'Deve conter código para marcar carrinho como CHECKED_OUT'
      );
    });
  });

  describe('Consistência entre endpoints', () => {
    it('ambos endpoints NÃO devem usar mock PDF (PDF real é baixado on-demand)', () => {
      const walletPath = path.join(process.cwd(), 'app/api/wallet/debit/route.ts');
      const paymentPath = path.join(process.cwd(), 'app/api/shipments/[id]/payment/route.ts');

      const walletContent = fs.readFileSync(walletPath, 'utf-8');
      const paymentContent = fs.readFileSync(paymentPath, 'utf-8');

      // Verificar que NÃO contém mais mockPdfBase64 (removido por segurança)
      assert.ok(
        !walletContent.includes('mockPdfBase64'),
        'wallet/debit NÃO deve ter mockPdfBase64 (PDF real via API Correios)'
      );
      assert.ok(
        !paymentContent.includes('mockPdfBase64'),
        'shipments/[id]/payment NÃO deve ter mockPdfBase64 (PDF real via API Correios)'
      );

      // Verificar comentário indicando download on-demand
      assert.ok(
        walletContent.includes('/api/labels/[id]/pdf'),
        'wallet/debit deve referenciar endpoint de download real'
      );
      assert.ok(
        paymentContent.includes('/api/labels/[id]/pdf'),
        'shipments/[id]/payment deve referenciar endpoint de download real'
      );
    });

    it('ambos endpoints devem marcar label como issued sem fileBase64', () => {
      const walletPath = path.join(process.cwd(), 'app/api/wallet/debit/route.ts');
      const paymentPath = path.join(process.cwd(), 'app/api/shipments/[id]/payment/route.ts');

      const walletContent = fs.readFileSync(walletPath, 'utf-8');
      const paymentContent = fs.readFileSync(paymentPath, 'utf-8');

      // Verificar que ambos marcam status como issued
      assert.ok(
        walletContent.includes("status: 'issued'"),
        'wallet/debit deve marcar status como issued'
      );
      assert.ok(
        paymentContent.includes("status: 'issued'"),
        'shipments/[id]/payment deve marcar status como issued'
      );

      // Verificar que NÃO definem fileBase64 inline
      assert.ok(
        !walletContent.includes('fileBase64:'),
        'wallet/debit NÃO deve definir fileBase64 inline'
      );
      assert.ok(
        !paymentContent.includes('fileBase64:'),
        'shipments/[id]/payment NÃO deve definir fileBase64 inline'
      );
    });
  });
});
