const { PrismaClient } = require('@prisma/client');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

const prisma = new PrismaClient();

function decrypt(encryptedText) {
  const key = process.env.ENCRYPTION_KEY || '';
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function checkPaymentStatus() {
  try {
    // 1. Buscar credenciais do banco
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago' },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!gateway || gateway.credentials.length === 0) {
      console.error('Gateway ou credenciais não encontrados');
      return;
    }

    const credential = gateway.credentials[0];
    const accessToken = decrypt(credential.accessToken);

    // 2. Consultar MP
    const client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 5000 },
    });

    const payment = new Payment(client);
    const result = await payment.get({ id: '1342664963' });

    console.log('\n=== STATUS DO PAGAMENTO NO MP ===');
    console.log('ID:', result.id);
    console.log('Status:', result.status);
    console.log('Status Detail:', result.status_detail);
    console.log('Date Created:', result.date_created);
    console.log('Date Approved:', result.date_approved);
    console.log('Transaction Amount:', result.transaction_amount);
    console.log('Payment Type:', result.payment_type_id);
    console.log('\n=================================\n');
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentStatus();
