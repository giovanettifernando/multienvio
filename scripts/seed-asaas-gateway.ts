/**
 * Registra (ou atualiza) o gateway Asaas e sua credencial.
 *
 * Uso: pnpm tsx scripts/seed-asaas-gateway.ts
 * Requer ASAAS_API_KEY no .env. ASAAS_WEBHOOK_TOKEN é opcional.
 */

import { prisma } from '../platform/db/db';
import { encrypt } from '../platform/integrations/shared/encryption.service';

async function main() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error('Defina ASAAS_API_KEY no .env antes de rodar');

  const baseUrl = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com';
  const isSandbox = baseUrl.includes('sandbox');

  const gateway = await prisma.paymentGateway.upsert({
    where: { slug: 'asaas' },
    create: {
      slug: 'asaas',
      name: 'Asaas',
      description: 'Gateway de pagamento Asaas — PIX, cartão e boleto',
      status: 'ACTIVE',
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      baseUrl,
      enabledMethods: ['PIX', 'CREDIT_CARD', 'BOLETO'],
      timeout: 30000,
    },
    update: {
      status: 'ACTIVE',
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      baseUrl,
      enabledMethods: ['PIX', 'CREDIT_CARD', 'BOLETO'],
    },
  });

  await prisma.paymentCredential.updateMany({
    where: { gatewayId: gateway.id, isActive: true },
    data: { isActive: false },
  });

  await prisma.paymentCredential.create({
    data: {
      gatewayId: gateway.id,
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      authType: 'API_KEY',
      accessToken: encrypt(apiKey),
      clientSecret: process.env.ASAAS_WEBHOOK_TOKEN
        ? encrypt(process.env.ASAAS_WEBHOOK_TOKEN)
        : null,
      isActive: true,
    },
  });

  // Desativa o gateway anterior, se existir
  await prisma.paymentGateway.updateMany({
    where: { slug: 'pagarme' },
    data: { status: 'INACTIVE' },
  });

  console.log(`Gateway Asaas registrado (${gateway.id}) em ambiente ${gateway.environment}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
