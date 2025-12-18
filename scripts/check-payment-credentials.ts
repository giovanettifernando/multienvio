import { prisma } from '@/platform/db/db';

async function checkPaymentCredentials() {
  console.log('========================================');
  console.log('VERIFICAÇÃO DE CREDENCIAIS');
  console.log('========================================\n');

  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
    include: {
      credentials: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!gateway) {
    console.log('❌ Gateway não encontrado');
    return;
  }

  console.log('🏦 Gateway:');
  console.log('   ID:', gateway.id);
  console.log('   Status:', gateway.status);
  console.log('   Environment:', gateway.environment);
  console.log('   Credentials count:', gateway.credentials.length);

  if (gateway.credentials.length > 0) {
    console.log('\n🔐 Credenciais no banco:');
    gateway.credentials.forEach((cred, idx) => {
      console.log(`\n   Credential ${idx + 1}:`);
      console.log(`      ID: ${cred.id}`);
      console.log(`      Active: ${cred.isActive}`);
      console.log(`      Public Key: ${cred.publicKey || 'VAZIO'}`);
      console.log(`      Access Token: ${cred.accessToken ? 'ENCRYPTED (' + cred.accessToken.length + ' chars)' : 'VAZIO'}`);
      console.log(`      Created: ${cred.createdAt}`);
    });
  } else {
    console.log('\n⚠️  Nenhuma credencial no banco');
  }

  console.log('\n📝 Variáveis de ambiente:');
  console.log('   NEXT_PUBLIC_MP_PUBLIC_KEY:', process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'NÃO DEFINIDO');
  console.log('   MP_ACCESS_TOKEN:', process.env.MP_ACCESS_TOKEN || 'NÃO DEFINIDO');
  console.log('   MP_SANDBOX_MODE:', process.env.MP_SANDBOX_MODE || 'NÃO DEFINIDO');

  await prisma.$disconnect();
  console.log('\n========================================');
}

checkPaymentCredentials();
