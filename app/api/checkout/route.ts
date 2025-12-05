
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { createShipmentWithVolumes } from '@/lib/shipments/create-with-volumes';
import { createInitialTrackingEvent } from '@/lib/tracking/create-event';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { integrateWithCarrier } from '@/lib/shipments/carrier-integration';

// Schema de validação do checkout
const checkoutSchema = z.object({
  quoteId: z.string(),
  recipient: z.object({
    nome: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    documento: z.string().nullish(),
    cep: z.string(),
    logradouro: z.string().nullish(),
    numero: z.string().nullish(),
    complemento: z.string().nullish(),
    bairro: z.string().nullish(),
    cidade: z.string(),
    uf: z.string(),
    observacoes: z.string().nullish(),
    salvarRecorrente: z.boolean().optional().default(false),
  }),
  document: z.object({
    type: z.enum(['NFE', 'DECLARACAO']),
    // Novo formato NFE: packages (NF por pacote com items)
    packages: z.array(z.object({
      chave: z.string(),
      xmlId: z.string().nullable().optional(),
      items: z.array(z.object({
        id: z.string(),
        sku: z.string().optional().nullable(),
        descricao: z.string(),
        ncm: z.string().optional().nullable(),
        cfop: z.string().optional().nullable(),
        quantidade: z.number(),
        pesoLiquido: z.number().optional().nullable(),
        valorUnitario: z.number(),
        valorTotal: z.number(),
      })),
    })).optional(),
    // Formato legado NFE: nfeKeys + nfeItems separados
    nfeKeys: z.array(z.object({ chave: z.string() })).optional(),
    nfeItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      valorTotal: z.number().optional(),
      quantidade: z.number(),
    })).optional(),
    // Formato legado DECLARACAO: declarationItems (lista única)
    declarationItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      quantidade: z.number(),
    })).optional(),
    // Novo formato DECLARACAO: volumeDeclarations (por volume)
    volumeDeclarations: z.array(z.object({
      volumeIndex: z.number(),
      items: z.array(z.object({
        id: z.string(),
        descricao: z.string(),
        valorUnitario: z.number(),
        quantidade: z.number(),
      })),
    })).optional(),
  }),
  volumes: z.array(z.object({
    peso: z.number(),
    altura: z.number(),
    largura: z.number(),
    comprimento: z.number(),
  })),
  insuranceValue: z.number().optional(),
  pickupPointId: z.string().optional().nullable(),
  carrier: z.string(),
  service: z.string(),
  originCep: z.string(),
  originCidade: z.string().optional(),
  originUf: z.string().optional(),
  // Dados completos do endereço de origem para integração com transportadora
  originAddress: z.object({
    cep: z.string(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
    nome: z.string().optional(), // label/apelido do endereço
  }).optional(),
  destinationCep: z.string(),
  estimatedDays: z.number(),
  freightCost: z.number(),
  solicitarColeta: z.boolean().optional().default(false), // Solicitar coleta na origem
});

type CheckoutPayload = z.infer<typeof checkoutSchema>;

/**
 * POST /api/checkout
 * Cria envio (shipment) e registra transação financeira
 */
export async function POST(request: Request) {
  try {
    // Autenticar usuário
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Parse e validar payload
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: CheckoutPayload = parsed.data;

    // Validar se há pelo menos 1 item no documento
    let hasDocumentItems = false;

    if (data.document.type === 'DECLARACAO') {
      // Formato novo: volumeDeclarations
      if (data.document.volumeDeclarations && data.document.volumeDeclarations.length > 0) {
        hasDocumentItems = data.document.volumeDeclarations.some((volDecl) =>
          volDecl.items && volDecl.items.length > 0 &&
          volDecl.items.some((item) => item.descricao && item.descricao.trim().length > 0)
        );
      }
      // Formato legado: declarationItems
      else if (data.document.declarationItems && data.document.declarationItems.length > 0) {
        hasDocumentItems = data.document.declarationItems.some(
          (item) => item.descricao && item.descricao.trim().length > 0
        );
      }
    } else if (data.document.type === 'NFE') {
      // Formato novo: packages (NF por pacote com items)
      if (data.document.packages && data.document.packages.length > 0) {
        hasDocumentItems = data.document.packages.some((pkg) =>
          pkg.items && pkg.items.length > 0
        );
      }
      // Formato legado: nfeKeys (apenas chaves)
      else if (data.document.nfeKeys && data.document.nfeKeys.length > 0) {
        hasDocumentItems = data.document.nfeKeys.some((k) => k.chave && k.chave.trim().length > 0);
      }
    }

    if (!hasDocumentItems) {
      return NextResponse.json(
        {
          message: 'Informe ao menos um item no documento do envio antes de continuar.',
          code: 'MISSING_DOCUMENT_ITEMS',
        },
        { status: 400 }
      );
    }

    // Calcular valor declarado
    let declaredValue = data.insuranceValue ?? 0;

    if (data.document.type === 'DECLARACAO') {
      // Novo formato: declaração por volume
      if (data.document.volumeDeclarations && data.document.volumeDeclarations.length > 0) {
        declaredValue = data.document.volumeDeclarations.reduce((totalSum, volDecl) => {
          const volumeTotal = volDecl.items.reduce((itemSum, item) =>
            itemSum + (item.valorUnitario * item.quantidade), 0
          );
          return totalSum + volumeTotal;
        }, 0);
      }
      // Formato legado: declaração única
      else if (data.document.declarationItems) {
        declaredValue = data.document.declarationItems.reduce((sum, item) =>
          sum + (item.valorUnitario * item.quantidade), 0
        );
      }
    } else if (data.document.type === 'NFE') {
      // Novo formato: packages (NF por pacote)
      if (data.document.packages && data.document.packages.length > 0) {
        declaredValue = data.document.packages.reduce((totalSum, pkg) => {
          const packageTotal = pkg.items.reduce((itemSum, item) =>
            itemSum + (item.valorTotal || (item.valorUnitario * item.quantidade)), 0
          );
          return totalSum + packageTotal;
        }, 0);
      }
      // Formato legado: nfeItems
      else if (data.document.nfeItems && data.document.nfeItems.length > 0) {
        declaredValue = data.document.nfeItems.reduce((sum, item) =>
          sum + (item.valorTotal || (item.valorUnitario * item.quantidade)), 0
        );
      }
    }

    // Gerar tracking code único (plataforma - customer-facing)
    const platformTrackingCode = `EL${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Preparar documento (priorizar NFE se ambos estiverem preenchidos)
    const documentData: {
      type: string;
      packages?: Array<{
        chave: string;
        xmlId?: string | null;
        items: Array<unknown>;
      }>;
      nfeKeys?: string[];
      nfeItems?: Array<unknown>;
      declarationItems?: Array<{ descricao: string; valorUnitario: number; quantidade: number }>;
      volumeDeclarations?: Array<{
        volumeIndex: number;
        items: Array<{ id: string; descricao: string; valorUnitario: number; quantidade: number }>;
      }>;
    } = {
      type: data.document.type,
    };

    if (data.document.type === 'NFE') {
      // Novo formato: packages (NF por pacote - preferencial)
      if (data.document.packages && data.document.packages.length > 0) {
        documentData.packages = data.document.packages;
      }
      // Formato legado: nfeKeys (apenas chaves - retrocompatibilidade)
      else if (data.document.nfeKeys && data.document.nfeKeys.length > 0) {
        documentData.nfeKeys = data.document.nfeKeys.map(k => k.chave);
      }
      // Formato legado: nfeItems (itens sem agrupamento por pacote)
      if (data.document.nfeItems && data.document.nfeItems.length > 0) {
        documentData.nfeItems = data.document.nfeItems;
      }
    } else if (data.document.type === 'DECLARACAO') {
      // Novo formato: declaração por volume (preferencial)
      if (data.document.volumeDeclarations && data.document.volumeDeclarations.length > 0) {
        documentData.volumeDeclarations = data.document.volumeDeclarations;
      }
      // Formato legado: declaração única (retrocompatibilidade)
      else if (data.document.declarationItems) {
        documentData.declarationItems = data.document.declarationItems;
      }
    }

    // Limpar valores undefined do documentData (Prisma JSON não aceita undefined)
    const cleanDocumentData = JSON.parse(JSON.stringify(documentData)) as Prisma.InputJsonValue;

    // Função auxiliar para salvar destinatário recorrente
    async function saveRecipientIfRequested() {
      if (!data.recipient.salvarRecorrente) {
        return;
      }

      if (!session) {
        console.error('[CHECKOUT] Session não encontrada, não é possível salvar destinatário');
        return;
      }

      // Normalizar CEP (remover hífen)
      const cepNormalized = data.recipient.cep.replace(/\D/g, '');

      // Normalizar documento (remover pontuação)
      const docNormalized = data.recipient.documento?.replace(/\D/g, '') || null;

      // Criar nameSearch (lowercase para busca case-insensitive)
      const nameSearch = data.recipient.nome.toLowerCase().trim();

      try {
        // Sempre criar novo destinatário recorrente
        // O usuário pode ter múltiplos endereços no mesmo CEP ou múltiplos destinatários
        await prisma.recipient.create({
          data: {
            userId: session.userId,
            name: data.recipient.nome,
            nameSearch: nameSearch,
            email: data.recipient.email || null,
            phone: data.recipient.telefone || null,
            document: docNormalized,
            cep: cepNormalized,
            logradouro: data.recipient.logradouro || '',
            numero: data.recipient.numero || '',
            complemento: data.recipient.complemento || null,
            bairro: data.recipient.bairro || '',
            cidade: data.recipient.cidade,
            uf: data.recipient.uf,
            notes: data.recipient.observacoes || null,
            isDefault: false,
          },
        });

      } catch (error) {
        console.error('[CHECKOUT] Erro ao salvar destinatário recorrente:', error);
      }
    }

    // Criar shipment dentro de uma transação
    const result = await prisma.$transaction(async (tx) => {
      // ====================================
      // IDEMPOTÊNCIA: Verificar se já existe um shipment para este checkout
      // ====================================

      // Buscar shipments criados recentemente (últimos 5 minutos) com dados idênticos
      const recentShipments = await tx.shipment.findMany({
        where: {
          senderId: session.userId,
          carrier: data.carrier,
          service: data.service,
          originCep: data.originCep,
          destinationCep: data.destinationCep,
          freightCost: data.freightCost,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
          },
        },
        include: {
          label: true,
          pickupRequest: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      if (recentShipments.length > 0) {
        const existingShipment = recentShipments[0];
        console.log('[CHECKOUT] Idempotência: Shipment já existe, retornando existente');

        return {
          shipment: existingShipment,
          packages: [], // Não precisamos retornar packages para idempotência
          label: existingShipment.label,
          pickupRequest: existingShipment.pickupRequest,
          trackingEvent: null,
          isIdempotent: true,
        };
      }

      // Obter ou criar carteira do usuário
      let wallet = await tx.wallet.findUnique({
        where: { userId: session.userId },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: session.userId,
            availableCents: 0,
            pendingCents: 0,
          },
        });
      }

      // Determinar status inicial baseado no tipo de coleta
      // REGRA DE NEGÓCIO:
      // - Coleta na origem (solicitarColeta = true) → ShipmentStatus.PICKUP_REQUESTED
      // - Ponto de coleta (pickupPointId != null) → ShipmentStatus.AWAITING_DROP_OFF_AT_POINT
      // - Outros casos → ShipmentStatus.AWAITING_DROP_OFF_AT_POINT (Fallback padrão)
      let initialStatus: ShipmentStatus;
      if (data.solicitarColeta === true) {
        initialStatus = ShipmentStatus.PICKUP_REQUESTED;
      } else if (data.pickupPointId) {
        initialStatus = ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
      } else {
        initialStatus = ShipmentStatus.AWAITING_DROP_OFF_AT_POINT; // Fallback padrão
      }

      const { shipment, packages } = await createShipmentWithVolumes(tx, {
        shipment: {
          platformTrackingCode,
          carrierTrackingCode: null,
          senderId: session.userId,
          recipientName: data.recipient.nome,
          recipientPhone: data.recipient.telefone ?? null,
          recipientEmail: data.recipient.email ?? null,
          recipientDocument: data.recipient.documento ?? null,
          originCep: data.originCep,
          destinationCep: data.destinationCep,
          destinationAddress: [
            data.recipient.logradouro,
            data.recipient.numero,
            data.recipient.complemento,
          ].filter(Boolean).join(', ') || null,
          destinationNeighborhood: data.recipient.bairro ?? null,
          destinationCity: data.recipient.cidade,
          destinationState: data.recipient.uf,
          declaredValue,
          carrier: data.carrier,
          service: data.service,
          estimatedDays: data.estimatedDays,
          freightCost: data.freightCost,
          pickupPointId: data.pickupPointId,
          document: cleanDocumentData,
          status: initialStatus, // Status dinâmico baseado no tipo de coleta
          paymentMethod: null,
        },
        volumes: data.volumes.map((vol) => ({
          peso: vol.peso,
          altura: vol.altura,
          largura: vol.largura,
          comprimento: vol.comprimento,
        })),
      });

      // Criar etiqueta automaticamente vinculada ao shipment
      // IMPORTANTE: Criar ANTES da integração para que a integração possa atualizar
      const label = await tx.label.create({
        data: {
          shipmentId: shipment.id,
          carrier: data.carrier,
          service: data.service,
          status: 'pending', // pending até o pagamento ser confirmado
          priceCents: Math.round(data.freightCost * 100), // Converter para centavos
          currency: 'BRL',
          trackingCode: platformTrackingCode, // Será atualizado pela integração se sucesso
          recipientName: data.recipient.nome, // Nome do destinatário denormalizado
          isPrinted: false,
        },
      });

      // 🚚 INTEGRAÇÃO COM TRANSPORTADORA: Criar pré-postagem e obter códigos de rastreio
      // Esta integração é best-effort - se falhar, o checkout continua com código interno
      try {
        // Buscar dados do usuário para CPF/CNPJ, telefone e email
        const user = await tx.user.findUnique({
          where: { id: session.userId },
          select: {
            name: true,
            email: true,
            phone: true,
            cpf: true,
            cnpj: true,
          },
        });

        // Extrair dados do remetente do originAddress (se disponível)
        const originData = data.originAddress || {
          cep: data.originCep,
          cidade: data.originCidade,
          uf: data.originUf,
        };

        // Determinar documento do remetente
        // Prioridade: Se CNPJ preenchido → CNPJ, senão → CPF
        const senderDocumento =
          (user?.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) ||
          user?.cpf ||
          '';

        // Dados do remetente
        const senderData = {
          nome: originData.nome || user?.name || 'Remetente',
          documento: senderDocumento.replace(/\D/g, ''), // Remove formatação
          telefone: user?.phone || undefined,
          email: user?.email || undefined,
          cep: (originData.cep || data.originCep).replace(/\D/g, ''),
          logradouro: originData.logradouro || undefined,
          numero: originData.numero || undefined,
          complemento: originData.complemento || undefined,
          bairro: originData.bairro || undefined,
          cidade: originData.cidade || data.originCidade || undefined,
          uf: originData.uf || data.originUf || undefined,
        };

        console.log('[CHECKOUT] Sender data:', {
          shipmentId: shipment.id,
          hasUserData: !!user,
          documento: senderData.documento ? `${senderData.documento.substring(0, 3)}***` : 'MISSING',
          nome: senderData.nome,
          cep: senderData.cep,
          logradouro: senderData.logradouro,
        });

        // Dados do destinatário
        const recipientData = {
          nome: data.recipient.nome,
          documento: data.recipient.documento || undefined,
          telefone: data.recipient.telefone || undefined,
          email: data.recipient.email || undefined,
          cep: data.recipient.cep.replace(/\D/g, ''),
          logradouro: data.recipient.logradouro || '',
          numero: data.recipient.numero || undefined,
          complemento: data.recipient.complemento || undefined,
          bairro: data.recipient.bairro || undefined,
          cidade: data.recipient.cidade,
          uf: data.recipient.uf,
        };

        // Chamar integração com transportadora
        const integrationResult = await integrateWithCarrier(tx, {
          shipmentId: shipment.id,
          carrier: data.carrier,
          serviceName: data.service,
          serviceCode: undefined, // Não temos o código de serviço no checkout direto
          packages,
          sender: senderData,
          recipient: recipientData,
          declaredValue,
          contentDescription: 'Mercadorias diversas',
        });

        if (integrationResult.success) {
          console.log('[CHECKOUT] Carrier integration successful:', {
            shipmentId: shipment.id,
            carrier: data.carrier,
            primaryTrackingCode: integrationResult.primaryTrackingCode,
            packagesUpdated: integrationResult.packageUpdates?.length || 0,
          });
        } else {
          // Log de falha mas não interrompe o checkout
          console.warn('[CHECKOUT] Carrier integration failed (non-blocking):', {
            shipmentId: shipment.id,
            carrier: data.carrier,
            error: integrationResult.errorMessage,
            errors: integrationResult.errors,
          });
        }
      } catch (integrationError) {
        // Erro na integração não deve impedir o checkout
        console.error('[CHECKOUT] Carrier integration error (non-blocking):', {
          shipmentId: shipment.id,
          carrier: data.carrier,
          error: integrationError instanceof Error ? integrationError.message : integrationError,
        });
      }

      // Se solicitarColeta estiver ativado, criar PickupRequest
      let pickupRequest = null;
      if (data.solicitarColeta) {
        // Verificar se já existe coleta para este shipment (idempotência)
        const existingPickup = await tx.pickupRequest.findUnique({
          where: { shipmentId: shipment.id },
        });

        if (!existingPickup) {
          // Para coleta normal: usar dados de ORIGEM
          // Para logística reversa: usar dados de DESTINO (onde será feita a coleta)
          // Por enquanto, assumimos coleta normal (pickup na origem)
          pickupRequest = await tx.pickupRequest.create({
            data: {
              userId: session.userId,
              shipmentId: shipment.id,
              originCep: data.originCep,
              originAddress: null, // Endereço completo não disponível no payload
              originCity: data.originCidade || null,
              originUf: data.originUf || null,
              status: 'PENDING',
              notes: null,
            },
          });
        } else {
          pickupRequest = existingPickup;
        }
      }

      // Criar evento inicial de rastreamento
      // Garante que a timeline nunca fique vazia
      const trackingEvent = await createInitialTrackingEvent(
        tx,
        shipment.id,
        initialStatus,
        new Date() // Usar data/hora atual
      );

      // Nota: A transação financeira será criada pelo /api/wallet/debit
      // quando o usuário confirmar o pagamento no modal

      return { shipment, packages, label, pickupRequest, trackingEvent, isIdempotent: false };
    });

    // Salvar destinatário recorrente se solicitado
    await saveRecipientIfRequested();

    // Verificar se há integração de pagamento configurada
    const paymentGatewayEnabled = process.env.PAYMENT_GATEWAY_ENABLED === 'true';
    const paymentGatewayUrl = process.env.PAYMENT_GATEWAY_URL;

    if (paymentGatewayEnabled && paymentGatewayUrl) {
      const paymentUrl = `${paymentGatewayUrl}/pay/${result.shipment.id}`;

      return NextResponse.json({
        shipmentId: result.shipment.id,
        trackingCode: result.shipment.platformTrackingCode, // Retornar código da plataforma
        paymentUrl,
        source: 'gateway',
      });
    }

    // Nota: Pagamento não é mais processado aqui.
    // O modal de checkout irá chamar /api/wallet/debit para processar o pagamento.

    // Outros métodos: retornar info do envio
    return NextResponse.json({
      shipmentId: result.shipment.id,
      trackingCode: result.shipment.platformTrackingCode, // Retornar código da plataforma
      publicTrackingId: result.shipment.publicTrackingId,
      trackingUrl: `/rastreio/${result.shipment.publicTrackingId}`,
      source: 'created',
      message: 'Envio criado. Aguardando confirmação de pagamento.',
    });
  } catch (error) {
    console.error('[CHECKOUT_POST]', error);
    // 🛡️ SECURITY FIX: Não expor mensagens de erro internas
    return NextResponse.json({ message: 'Erro ao processar checkout' }, { status: 500 });
  }
}
