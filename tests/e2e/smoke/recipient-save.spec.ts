import { test, expect } from '@playwright/test';
import { prisma } from '@/platform/db/db';

/**
 * Teste E2E: Salvamento de Destinatário Recorrente no Checkout
 *
 * Fluxo testado:
 * 1. Criar usuário de teste
 * 2. Fazer login
 * 3. Criar cotação com destinatário
 * 4. Marcar flag "salvarRecorrente"
 * 5. Fazer checkout
 * 6. Verificar se destinatário foi salvo na tabela recipients
 * 7. Verificar se destinatário aparece na lista de recorrentes
 * 8. Limpar dados de teste
 */

test.describe('Salvamento de Destinatários Recorrentes', () => {
  const testEmail = `test-recipient-${Date.now()}@example.com`;
  const testPassword = 'Test123!@#';
  let userId: string;
  let recipientId: string | null = null;

  // Setup: criar usuário de teste
  test.beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Usuário Teste Recipient',
        passwordHash: '$2a$10$dummyhash', // Hash fictício para teste
        status: 'active',
        emailVerified: true,
      },
    });
    userId = user.id;
  });

  // Cleanup: remover dados de teste
  test.afterAll(async () => {
    // Deletar destinatário recorrente criado
    if (recipientId) {
      await prisma.recipient.deleteMany({
        where: { userId },
      });
    }

    // Deletar shipments e labels criados
    await prisma.label.deleteMany({
      where: {
        shipment: {
          senderId: userId,
        },
      },
    });
    await prisma.shipment.deleteMany({
      where: { senderId: userId },
    });

    // Deletar usuário de teste
    await prisma.user.delete({
      where: { id: userId },
    });
  });

  test('deve salvar destinatário como recorrente após checkout com flag marcada', async ({
    page,
  }) => {
    // ATENÇÃO: Este teste é um placeholder que documenta o comportamento esperado
    // Para executá-lo de verdade, você precisaria:
    // 1. Configurar autenticação de teste (mock ou session real)
    // 2. Navegar pela UI de cotações
    // 3. Preencher formulário completo de destinatário
    // 4. Marcar checkbox de salvarRecorrente
    // 5. Concluir checkout

    // Por enquanto, vamos testar a API diretamente via fetch

    // 1. Simular criação de cotação (normalmente feito via UI)
    const quotePayload = {
      origem: { cep: '01310-100' },
      destino: { cep: '04094-050' },
      volumes: [
        {
          peso: 1,
          altura: 10,
          largura: 10,
          comprimento: 10,
        },
      ],
    };

    // 2. Simular checkout com salvarRecorrente = true
    const checkoutPayload = {
      quoteId: 'test-quote-id',
      recipient: {
        nome: 'João da Silva Teste',
        telefone: '11987654321',
        email: 'joao.teste@example.com',
        documento: '12345678901',
        cep: '04094-050',
        logradouro: 'Rua Teste',
        numero: '123',
        complemento: 'Apto 45',
        bairro: 'Bairro Teste',
        cidade: 'São Paulo',
        uf: 'SP',
        observacoes: 'Entregar no portão',
        salvarRecorrente: true, // FLAG MARCADA
      },
      document: {
        type: 'DECLARACAO',
        declarationItems: [
          {
            descricao: 'Produto de teste',
            valorUnitario: 100,
            quantidade: 1,
          },
        ],
      },
      volumes: [
        {
          peso: 1,
          altura: 10,
          largura: 10,
          comprimento: 10,
        },
      ],
      insuranceValue: 100,
      pickupPointId: null,
      carrier: 'CORREIOS',
      service: 'PAC',
      originCep: '01310-100',
      originCidade: 'São Paulo',
      originUf: 'SP',
      destinationCep: '04094-050',
      estimatedDays: 5,
      freightCost: 25.5,
      totalCost: 25.5,
      solicitarColeta: false,
    };

    // TODO: Implementar chamada real para /api/checkout com autenticação
    // const response = await fetch('http://localhost:3000/api/checkout', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     // Adicionar token de autenticação aqui
    //   },
    //   body: JSON.stringify(checkoutPayload),
    // });

    // 3. Verificar se destinatário foi salvo no banco
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Aguardar processamento

    const savedRecipient = await prisma.recipient.findFirst({
      where: {
        userId,
        document: '12345678901',
        cep: '04094050', // CEP normalizado (sem hífen)
      },
    });

    // Validações
    expect(savedRecipient).toBeTruthy();
    if (savedRecipient) {
      recipientId = savedRecipient.id;

      expect(savedRecipient.name).toBe('João da Silva Teste');
      expect(savedRecipient.email).toBe('joao.teste@example.com');
      expect(savedRecipient.phone).toBe('11987654321');
      expect(savedRecipient.document).toBe('12345678901');
      expect(savedRecipient.cep).toBe('04094050');
      expect(savedRecipient.logradouro).toBe('Rua Teste');
      expect(savedRecipient.numero).toBe('123');
      expect(savedRecipient.complemento).toBe('Apto 45');
      expect(savedRecipient.bairro).toBe('Bairro Teste');
      expect(savedRecipient.cidade).toBe('São Paulo');
      expect(savedRecipient.uf).toBe('SP');
      expect(savedRecipient.notes).toBe('Entregar no portão');

      console.log('✅ Destinatário recorrente salvo com sucesso:', savedRecipient);
    }
  });

  test('deve permitir múltiplos destinatários com mesmo documento (endereços diferentes)', async () => {
    // 1. Criar primeiro destinatário (endereço residencial)
    const recipient1 = await prisma.recipient.create({
      data: {
        userId,
        name: 'Maria Teste',
        nameSearch: 'maria teste',
        document: '98765432100',
        cep: '01310100',
        logradouro: 'Rua Residencial',
        numero: '100',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        notes: 'Casa',
      },
    });

    // 2. Criar segundo destinatário (mesmo documento, endereço comercial)
    const recipient2 = await prisma.recipient.create({
      data: {
        userId,
        name: 'Maria Teste',
        nameSearch: 'maria teste',
        document: '98765432100',
        cep: '01310200',
        logradouro: 'Avenida Comercial',
        numero: '500',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        notes: 'Trabalho',
      },
    });

    // 3. Verificar que ambos foram criados
    const count = await prisma.recipient.count({
      where: {
        userId,
        document: '98765432100',
      },
    });

    expect(count).toBe(2);

    // 4. Verificar que cada um tem seu endereço
    const recipients = await prisma.recipient.findMany({
      where: {
        userId,
        document: '98765432100',
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(recipients[0].logradouro).toBe('Rua Residencial');
    expect(recipients[0].notes).toBe('Casa');
    expect(recipients[1].logradouro).toBe('Avenida Comercial');
    expect(recipients[1].notes).toBe('Trabalho');

    console.log('✅ Múltiplos endereços permitidos para o mesmo documento');

    // Cleanup deste teste
    await prisma.recipient.deleteMany({
      where: {
        id: {
          in: [recipient1.id, recipient2.id],
        },
      },
    });
  });

  test('deve permitir múltiplos destinatários no mesmo CEP (pessoas diferentes)', async () => {
    // 1. Criar destinatários diferentes no mesmo CEP
    const recipient1 = await prisma.recipient.create({
      data: {
        userId,
        name: 'João Silva',
        nameSearch: 'joão silva',
        document: '11111111111',
        cep: '01310100',
        logradouro: 'Rua Principal',
        numero: '100',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    });

    const recipient2 = await prisma.recipient.create({
      data: {
        userId,
        name: 'Maria Santos',
        nameSearch: 'maria santos',
        document: '22222222222',
        cep: '01310100',
        logradouro: 'Rua Principal',
        numero: '200',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    });

    // 2. Verificar que ambos foram criados
    const count = await prisma.recipient.count({
      where: {
        userId,
        cep: '01310100',
      },
    });

    expect(count).toBe(2);

    console.log('✅ Múltiplas pessoas permitidas no mesmo CEP');

    // Cleanup deste teste
    await prisma.recipient.deleteMany({
      where: {
        id: {
          in: [recipient1.id, recipient2.id],
        },
      },
    });
  });
});
