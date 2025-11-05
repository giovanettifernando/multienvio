/**
 * Script de teste para validar o fluxo de verificação de e-mail de coletores
 *
 * Fluxo esperado:
 * 1. Criar coletor via API de registro → status BLOCKED, pfEmailVerified=false
 * 2. Verificar token via API → status INACTIVE, pfEmailVerified=true, pfEmailVerifiedAt preenchido
 * 3. Listar coletores no admin → coletor aparece na lista
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCollectorEmailVerification() {
  console.log('🧪 Iniciando teste de verificação de e-mail de coletores...\n');

  try {
    // 1. Buscar um coletor existente com email verificado
    console.log('📋 Buscando coletores existentes...');
    const collectors = await prisma.collector.findMany({
      where: {
        pfEmailVerified: true,
      },
      select: {
        id: true,
        pfNome: true,
        pfEmail: true,
        pfEmailVerified: true,
        pfEmailVerifiedAt: true,
        status: true,
      },
      take: 5,
    });

    console.log(`✅ Encontrados ${collectors.length} coletores com e-mail verificado:\n`);
    collectors.forEach((c, i) => {
      console.log(`${i + 1}. ID: ${c.id}`);
      console.log(`   Nome: ${c.pfNome}`);
      console.log(`   Email: ${c.pfEmail}`);
      console.log(`   Verificado: ${c.pfEmailVerified}`);
      console.log(`   Verificado em: ${c.pfEmailVerifiedAt}`);
      console.log(`   Status: ${c.status}\n`);
    });

    // 2. Buscar coletores aguardando verificação
    console.log('⏳ Buscando coletores aguardando verificação...');
    const pending = await prisma.collector.findMany({
      where: {
        pfEmailVerified: false,
        pfEmailVerificationToken: { not: null },
      },
      select: {
        id: true,
        pfNome: true,
        pfEmail: true,
        pfEmailVerified: true,
        pfEmailVerificationToken: true,
        status: true,
      },
      take: 5,
    });

    console.log(`📬 Encontrados ${pending.length} coletores aguardando verificação:\n`);
    pending.forEach((c, i) => {
      console.log(`${i + 1}. ID: ${c.id}`);
      console.log(`   Nome: ${c.pfNome}`);
      console.log(`   Email: ${c.pfEmail}`);
      console.log(`   Token: ${c.pfEmailVerificationToken ? c.pfEmailVerificationToken.substring(0, 16) + '...' : 'N/A'}`);
      console.log(`   Status: ${c.status}\n`);
    });

    // 3. Verificar status no banco
    console.log('📊 Estatísticas de coletores:');
    const stats = await prisma.collector.groupBy({
      by: ['status', 'pfEmailVerified'],
      _count: true,
    });

    console.log('\nStatus | Email Verificado | Quantidade');
    console.log('-------|------------------|----------');
    stats.forEach(s => {
      console.log(`${s.status.padEnd(7)} | ${s.pfEmailVerified ? 'Sim' : 'Não'}              | ${s._count}`);
    });

    console.log('\n✅ Teste concluído com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('1. Registrar novo coletor em /coletores/cadastro');
    console.log('2. Verificar que status = BLOCKED e pfEmailVerified = false');
    console.log('3. Clicar no link do e-mail de verificação');
    console.log('4. Verificar que status = INACTIVE e pfEmailVerified = true');
    console.log('5. Confirmar que aparece em /admin/coletores');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCollectorEmailVerification()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
