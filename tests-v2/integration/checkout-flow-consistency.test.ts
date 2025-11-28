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
    it('ambos endpoints devem usar mesmo mock PDF base64', () => {
      const walletPath = path.join(process.cwd(), 'app/api/wallet/debit/route.ts');
      const paymentPath = path.join(process.cwd(), 'app/api/shipments/[id]/payment/route.ts');

      const walletContent = fs.readFileSync(walletPath, 'utf-8');
      const paymentContent = fs.readFileSync(paymentPath, 'utf-8');

      // Extrair o mockPdfBase64 de ambos os arquivos
      const mockPdfPattern = /mockPdfBase64\s*=\s*'([^']+)'/;
      const walletMatch = walletContent.match(mockPdfPattern);
      const paymentMatch = paymentContent.match(mockPdfPattern);

      assert.ok(walletMatch, 'wallet/debit deve ter mockPdfBase64');
      assert.ok(paymentMatch, 'shipments/[id]/payment deve ter mockPdfBase64');
      assert.strictEqual(
        walletMatch![1],
        paymentMatch![1],
        'Ambos devem usar o mesmo mock PDF para consistência'
      );
    });

    it('ambos endpoints devem definir contentType e sizeBytes na label', () => {
      const walletPath = path.join(process.cwd(), 'app/api/wallet/debit/route.ts');
      const paymentPath = path.join(process.cwd(), 'app/api/shipments/[id]/payment/route.ts');

      const walletContent = fs.readFileSync(walletPath, 'utf-8');
      const paymentContent = fs.readFileSync(paymentPath, 'utf-8');

      // Verificar campos obrigatórios na atualização da label
      for (const [name, content] of [['wallet/debit', walletContent], ['shipments/[id]/payment', paymentContent]]) {
        assert.ok(
          content.includes("contentType: 'application/pdf'"),
          `${name} deve definir contentType: 'application/pdf'`
        );
        assert.ok(
          content.includes('sizeBytes:'),
          `${name} deve definir sizeBytes`
        );
      }
    });
  });
});
