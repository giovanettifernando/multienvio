/**
 * Script de teste para validar o fluxo de login de coletores
 *
 * Testa:
 * 1. Status dos coletores no banco (ACTIVE, INACTIVE, BLOCKED)
 * 2. Coletores com email verificado vs não verificado
 * 3. Coletores com credenciais (senha) cadastradas
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCollectorLogin() {
  console.log('🧪 Testando fluxo de login de coletores\n');

  try {
    // 1. Estatísticas gerais
    console.log('📊 Estatísticas de coletores no banco:');
    console.log('════════════════════════════════════════════════════════\n');

    const stats = await prisma.collector.groupBy({
      by: ['status', 'pfEmailVerified'],
      _count: true,
    });

    console.log('Status    | Email Verificado | Quantidade');
    console.log('----------|------------------|----------');
    stats.forEach(s => {
      const verified = s.pfEmailVerified ? 'Sim ✓' : 'Não ✗';
      console.log(`${s.status.padEnd(9)} | ${verified.padEnd(16)} | ${s._count}`);
    });

    // 2. Coletores ACTIVE com email verificado (podem logar)
    console.log('\n✅ Coletores ACTIVE com e-mail verificado (PODEM LOGAR):');
    console.log('════════════════════════════════════════════════════════\n');

    const activeVerified = await prisma.collector.findMany({
      where: {
        status: 'ACTIVE',
        pfEmailVerified: true,
      },
      include: {
        credential: {
          select: {
            passwordHash: true,
          },
        },
      },
      take: 5,
    });

    if (activeVerified.length === 0) {
      console.log('❌ Nenhum coletor ACTIVE com e-mail verificado encontrado');
    } else {
      activeVerified.forEach((c, i) => {
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail})`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Email Verificado: ${c.pfEmailVerified ? '✓' : '✗'}`);
        console.log(`   Tem Senha: ${c.credential ? '✓' : '✗ PROBLEMA!'}`);
        console.log();
      });
    }

    // 3. Coletores INACTIVE com email verificado (bloqueados no login)
    console.log('⏳ Coletores INACTIVE com e-mail verificado (AGUARDANDO APROVAÇÃO):');
    console.log('════════════════════════════════════════════════════════\n');

    const inactiveVerified = await prisma.collector.findMany({
      where: {
        status: 'INACTIVE',
        pfEmailVerified: true,
      },
      include: {
        credential: {
          select: {
            passwordHash: true,
          },
        },
      },
      take: 5,
    });

    if (inactiveVerified.length === 0) {
      console.log('❌ Nenhum coletor INACTIVE com e-mail verificado encontrado');
    } else {
      inactiveVerified.forEach((c, i) => {
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail})`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Email Verificado: ${c.pfEmailVerified ? '✓' : '✗'}`);
        console.log(`   Tem Senha: ${c.credential ? '✓' : '✗ PROBLEMA!'}`);
        console.log();
      });
    }

    // 4. Coletores BLOCKED (email não verificado - bloqueados no login)
    console.log('🚫 Coletores BLOCKED (E-MAIL NÃO VERIFICADO):');
    console.log('════════════════════════════════════════════════════════\n');

    const blocked = await prisma.collector.findMany({
      where: {
        status: 'BLOCKED',
      },
      include: {
        credential: {
          select: {
            passwordHash: true,
          },
        },
      },
      take: 5,
    });

    if (blocked.length === 0) {
      console.log('✓ Nenhum coletor BLOCKED encontrado');
    } else {
      blocked.forEach((c, i) => {
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail || 'SEM EMAIL'})`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Email Verificado: ${c.pfEmailVerified ? '✓' : '✗'}`);
        console.log(`   Token Verificação: ${c.pfEmailVerificationToken ? 'Pendente' : 'N/A'}`);
        console.log(`   Tem Senha: ${c.credential ? '✓' : '✗'}`);
        console.log();
      });
    }

    // 5. Coletores sem credenciais (problemas!)
    console.log('⚠️  Coletores SEM CREDENCIAIS (PROBLEMA):');
    console.log('════════════════════════════════════════════════════════\n');

    const withoutCredentials = await prisma.collector.findMany({
      where: {
        credential: null,
      },
      take: 5,
    });

    if (withoutCredentials.length === 0) {
      console.log('✓ Todos os coletores possuem credenciais');
    } else {
      withoutCredentials.forEach((c, i) => {
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail || 'SEM EMAIL'})`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log();
      });
    }

    // 6. Resumo do fluxo esperado
    console.log('\n📋 Resumo do Fluxo de Login:');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('🔹 Validações da API /api/coletores/auth/login:');
    console.log('  1️⃣  Busca por e-mail (case-insensitive)');
    console.log('  2️⃣  Verifica senha com bcrypt.compare');
    console.log('  3️⃣  Verifica pfEmailVerified:');
    console.log('     → false = 403 EMAIL_NOT_VERIFIED');
    console.log('  4️⃣  Verifica status:');
    console.log('     → BLOCKED = 403 ACCOUNT_INACTIVE (bloqueado)');
    console.log('     → INACTIVE = 403 ACCOUNT_INACTIVE (aguardando aprovação)');
    console.log('     → ACTIVE = 200 OK (gera JWT e cookie)');
    console.log('\n🔹 Códigos de erro retornados:');
    console.log('  • 401 INVALID_CREDENTIALS - E-mail ou senha incorretos');
    console.log('  • 403 EMAIL_NOT_VERIFIED - E-mail não verificado');
    console.log('  • 403 ACCOUNT_INACTIVE - Conta inativa ou bloqueada');
    console.log('  • 500 SERVER_ERROR - Erro no servidor');

    console.log('\n✅ Teste concluído!\n');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCollectorLogin()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
